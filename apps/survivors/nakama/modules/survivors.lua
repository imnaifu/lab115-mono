--[[
大厂幸存者's server side (.78, the user: 加个排行榜，列出最短通关时间; 玩家自己起昵称; 每张地图一个榜).

A run is won by clearing the floor after 10:00 (game/DESIGN.md 2.1); its time, from the start to
the last enemy down, goes on its map's board, shortest first, best per player. Everything goes
through the RPCs below, so the boards are authoritative: a client can't write a record itself.

  survivors_set_name    {name}                    -> {ok, name} | {error}
  survivors_submit      {map, ms, job, run}       -> {ok, rank, best_ms} | {error}
  survivors_board       {map}                     -> {records: [...], me: {...}|null, name}
  survivors_report      {user}                    -> {ok}
  survivors_feedback    {text, where, context}    -> {ok} | {error}

Names are the account's display name. One that enough players report (REPORTS_TO_HIDE) shows as
匿名员工 until its owner picks a new one; the reports are kept in the storage collection
name_reports (owned by the system user) for a look in the console.

提意见 (.94, the user picked R4 of the money plan: 游戏内「提意见」入口): what a player types goes
into the storage collection feedback, one object per message, owned by its player but readable and
writable by no client (permission 0/0), so it is read in the console only (Storage → feedback). A
player sends at most FEEDBACK_PER_DAY a day (UTC), counted in feedback_quota. When the cloud save's
deletion becomes a real one (before the App), these go with the account.
]]

local nk = require("nakama")

local MAPS = { sv = true, ldn = true, sea = true, sg = true, bj = true }
local JOBS = { coder = true, pm = true, designer = true, ops = true, data_scientist = true }
-- A clear can't come before 10:00 (nothing is won earlier) and one past 30:00 is no time worth ranking.
local MIN_MS = 600000
local MAX_MS = 1800000
local BOARD_SIZE = 50
local NAME_MIN = 2
local NAME_MAX = 12
local REPORTS_TO_HIDE = 3
local HIDDEN_NAME = "匿名员工"
local SYSTEM_USER = "00000000-0000-0000-0000-000000000000"
local FEEDBACK_MIN = 2
local FEEDBACK_MAX = 500
local FEEDBACK_PER_DAY = 5
-- What the game says about itself with a message (Hud._send_feedback), each cut to this many bytes.
local FEEDBACK_CONTEXT = { version = 8, lang = 4, device = 24, screen = 16, map = 8, job = 16, runs = 8 }
local FEEDBACK_WHERE = { settings = true, ["end"] = true }
-- Not allowed in a name (lower-cased, as parts of it): pretending to be the game, and the
-- commonest abuse; nothing short enough to sit inside ordinary names (sb, dick). Reports catch the rest.
local BLOCKED = {
  "官方", "管理员", "客服", "系统", "admin", "official", "moderator", "匿名员工",
  "傻逼", "傻b", "煞笔", "操你", "草你", "妈的", "尼玛", "你妈", "去死",
  "fuck", "shit", "bitch", "cunt", "nigger", "nigga", "pussy",
  "法轮", "习近平", "共产党", "台独", "藏独", "疆独", "六四",
}

local function board_id(map)
  return "clear_" .. map
end

for map, _ in pairs(MAPS) do
  -- Ascending (the shortest clear on top), keeping each player's best; no reset; ranks on.
  local ok, err = pcall(nk.leaderboard_create, board_id(map), true, "asc", "best", nil, { map = map }, true)
  if not ok then
    nk.logger_warn(("leaderboard %s: %s"):format(board_id(map), tostring(err)))
  end
end

local function reply(value)
  return nk.json_encode(value)
end

local function decode(payload)
  if payload == nil or payload == "" then
    return {}
  end
  local ok, value = pcall(nk.json_decode, payload)
  if ok and type(value) == "table" then
    return value
  end
  return {}
end

local function trim(text)
  return (text:gsub("^%s+", ""):gsub("%s+$", ""))
end

-- Characters, not bytes: everything but UTF-8 continuation bytes.
local function length(text)
  local _, count = text:gsub("[^\128-\191]", "")
  return count
end

local function name_problem(name)
  if length(name) < NAME_MIN or length(name) > NAME_MAX then
    return "length"
  end
  if name:find("[%c<>\"'`\\]") then
    return "characters"
  end
  local lowered = name:lower():gsub("%s", "")
  for _, word in ipairs(BLOCKED) do
    if lowered:find(word, 1, true) then
      return "blocked"
    end
  end
  return nil
end

-- A user id as Nakama writes them (8-4-4-4-12 hex digits), checked before a lookup that throws.
local function is_user_id(text)
  return type(text) == "string" and text:match("^%x+%-%x+%-%x+%-%x+%-%x+$") ~= nil and #text == 36
end

local function display_name(user_id)
  local ok, account = pcall(nk.account_get_id, user_id)
  if not ok or account == nil then
    return ""
  end
  return account.user.display_name or ""
end

local function reports_of(user_ids)
  local reads = {}
  for _, id in ipairs(user_ids) do
    table.insert(reads, { collection = "name_reports", key = id, user_id = SYSTEM_USER })
  end
  local hidden = {}
  if #reads == 0 then
    return hidden
  end
  for _, object in ipairs(nk.storage_read(reads)) do
    if object.value.count ~= nil and object.value.count >= REPORTS_TO_HIDE then
      hidden[object.key] = true
    end
  end
  return hidden
end

local function set_name(context, payload)
  local name = trim(tostring(decode(payload).name or ""))
  local problem = name_problem(name)
  if problem ~= nil then
    return reply({ error = problem })
  end
  nk.account_update_id(context.user_id, nil, nil, name, nil, nil, nil, nil)
  -- A new name starts clean.
  nk.storage_delete({ { collection = "name_reports", key = context.user_id, user_id = SYSTEM_USER } })
  return reply({ ok = true, name = name })
end

local function own_record(map, user_id)
  local _, owner_records = nk.leaderboard_records_list(board_id(map), { user_id }, 1, nil, 0)
  return owner_records and owner_records[1] or nil
end

local function submit(context, payload)
  local entry = decode(payload)
  local map, ms, job = entry.map, tonumber(entry.ms), entry.job
  if not MAPS[map] or not JOBS[job] or ms == nil or ms < MIN_MS or ms > MAX_MS then
    return reply({ error = "invalid" })
  end
  if display_name(context.user_id) == "" then
    return reply({ error = "no_name" })
  end
  nk.leaderboard_record_write(board_id(map), context.user_id, nil, math.floor(ms), 0,
    { job = job, run = tostring(entry.run or "") })
  local record = own_record(map, context.user_id)
  return reply({ ok = true, rank = record and record.rank or 0, best_ms = record and record.score or ms })
end

local function board(context, payload)
  local map = decode(payload).map
  if not MAPS[map] then
    return reply({ error = "invalid" })
  end
  local records, owner_records = nk.leaderboard_records_list(board_id(map), { context.user_id }, BOARD_SIZE, nil, 0)
  records = records or {}
  local ids = {}
  for _, record in ipairs(records) do
    table.insert(ids, record.owner_id)
  end
  local names = {}
  if #ids > 0 then
    for _, user in ipairs(nk.users_get_id(ids)) do
      names[user.user_id] = user.display_name or ""
    end
  end
  local hidden = reports_of(ids)
  local function row(record)
    local name = names[record.owner_id] or ""
    if hidden[record.owner_id] or name == "" then
      name = HIDDEN_NAME
    end
    local metadata = record.metadata or {}
    return { rank = record.rank, user = record.owner_id, name = name, ms = record.score,
      job = metadata.job or "", me = record.owner_id == context.user_id }
  end
  local rows = {}
  for _, record in ipairs(records) do
    table.insert(rows, row(record))
  end
  local me = nil
  if owner_records and owner_records[1] then
    names[context.user_id] = display_name(context.user_id)
    me = row(owner_records[1])
  end
  -- An empty Lua table encodes as {}, not []: the client reads a missing `records` as none.
  local answer = { me = me, name = display_name(context.user_id) }
  if #rows > 0 then
    answer.records = rows
  end
  return reply(answer)
end

local function report(context, payload)
  local target = tostring(decode(payload).user or "")
  if not is_user_id(target) or target == context.user_id then
    return reply({ error = "invalid" })
  end
  local objects = nk.storage_read({ { collection = "name_reports", key = target, user_id = SYSTEM_USER } })
  local value = (objects[1] and objects[1].value) or { count = 0, by = {}, name = "" }
  value.by = value.by or {}
  -- Each player counts once against a name.
  if not value.by[context.user_id] then
    value.by[context.user_id] = true
    value.count = (value.count or 0) + 1
    value.name = display_name(target)
    nk.storage_write({ { collection = "name_reports", key = target, user_id = SYSTEM_USER, value = value,
      permission_read = 0, permission_write = 0 } })
  end
  return reply({ ok = true })
end

local function feedback(context, payload)
  local entry = decode(payload)
  local text = trim(tostring(entry.text or ""))
  if length(text) < FEEDBACK_MIN or length(text) > FEEDBACK_MAX then
    return reply({ error = "length" })
  end
  local where = tostring(entry.where or "")
  if not FEEDBACK_WHERE[where] then
    where = "other"
  end
  -- The day in UTC, as a number of days: a player's count starts over at midnight UTC.
  local day = math.floor(nk.time() / 86400000)
  local quota_key = { collection = "feedback_quota", key = "today", user_id = context.user_id }
  local objects = nk.storage_read({ quota_key })
  local quota = (objects[1] and objects[1].value) or {}
  local count = quota.day == day and (quota.count or 0) or 0
  if count >= FEEDBACK_PER_DAY then
    return reply({ error = "too_many" })
  end
  local about = {}
  local given = type(entry.context) == "table" and entry.context or {}
  for key, limit in pairs(FEEDBACK_CONTEXT) do
    if given[key] ~= nil then
      about[key] = tostring(given[key]):sub(1, limit)
    end
  end
  nk.storage_write({
    { collection = "feedback", key = nk.uuid_v4(), user_id = context.user_id, permission_read = 0, permission_write = 0,
      value = { text = text, where = where, about = about, name = display_name(context.user_id) } },
    { collection = quota_key.collection, key = quota_key.key, user_id = context.user_id, permission_read = 0,
      permission_write = 0, value = { day = day, count = count + 1 } },
  })
  return reply({ ok = true })
end

nk.register_rpc(set_name, "survivors_set_name")
nk.register_rpc(submit, "survivors_submit")
nk.register_rpc(board, "survivors_board")
nk.register_rpc(report, "survivors_report")
nk.register_rpc(feedback, "survivors_feedback")
