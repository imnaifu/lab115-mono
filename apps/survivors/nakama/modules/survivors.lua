--[[
大厂幸存者's server side (.78, the user: 加个排行榜，列出最短通关时间; 玩家自己起昵称; 每张地图一个榜).

A run is won by clearing the floor after 10:00 (game/DESIGN.md 2.1); its time, from the start to
the last enemy down, goes on its map's board, shortest first, best per player. Everything goes
through the RPCs below, so the boards are authoritative: a client can't write a record itself.

  survivors_set_name    {name}                    -> {ok, name} | {error}
  survivors_submit      {map, ms, job, run}       -> {ok, rank, best_ms} | {error}
  survivors_board       {map}                     -> {records: [...], me: {...}|null, name}
  survivors_report      {user}                    -> {ok}

Names are the account's display name. One that enough players report (REPORTS_TO_HIDE) shows as
匿名员工 until its owner picks a new one; the reports are kept in the storage collection
name_reports (owned by the system user) for a look in the console.
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

local function display_name(user_id)
  local account = nk.account_get_id(user_id)
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
  return reply({ records = rows, me = me, name = display_name(context.user_id) })
end

local function report(context, payload)
  local target = tostring(decode(payload).user or "")
  if target == "" or target == context.user_id then
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

nk.register_rpc(set_name, "survivors_set_name")
nk.register_rpc(submit, "survivors_submit")
nk.register_rpc(board, "survivors_board")
nk.register_rpc(report, "survivors_report")
