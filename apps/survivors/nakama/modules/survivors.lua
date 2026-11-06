--[[
大厂幸存者's server side (.78, the user: 加个排行榜，列出最短通关时间; 玩家自己起昵称; 每张地图一个榜).

A run is won by clearing the floor after 10:00 (game/DESIGN.md 2.1); its time, from the start to
the last enemy down, goes on its map's board, shortest first, best per player. From .96 (the user:
没完成也记入榜，只要超过 1min 都算) a run that wasn't won goes on too once it lasted a minute, under
every clear, the longest first: its score is SURVIVED_FROM minus how long it lasted, so one board
kept ascending still ranks every clear (10:00-30:00) above every other run. Everything goes
through the RPCs below, so the boards are authoritative: a client can't write a record itself.

  survivors_set_name    {name}                    -> {ok, name} | {error}
  survivors_submit      {map, ms, job, run, cleared} -> {ok, rank, best_ms, best_cleared} | {error}
  survivors_board       {map}                     -> {records: [...], me: {...}|null, name}

`cleared` missing counts as true (a client before .96 sent clears only). A record comes back with
`ms` (the clear time, or how long the run lasted) and `cleared`.
  survivors_name_check  {name}                    -> {ok} | {error}
  survivors_feedback    {text, where, context}    -> {ok} | {error}

Names are the account's display name. From .97 (the user: 去掉改昵称逻辑，新建昵称需要全局唯一，输入的
时候校验) a player picks one once and keeps it, and no two players share one, ignoring case and
spaces (name_key): survivors_name_check answers as the player types, survivors_set_name checks
again and claims the name in the storage collection names (key name_key, owned by the system
user, written only if it isn't there, so of two players taking a name at once one gets it). A
name picked before .97 has no claim, so the users table is looked at too. 举报 (.78-.96, three
reports hid a name as 匿名员工 until it was changed) is gone with changing names (the user: 去掉);
the storage collection name_reports it filled is left as it was.

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
-- A run not won counts from a minute on (.96), as SURVIVED_FROM - its length: 8,200,000-9,940,000,
-- all above any clear's score, the longer the lower.
local SURVIVE_MIN_MS = 60000
local SURVIVED_FROM = 10000000
local BOARD_SIZE = 50
local NAME_MIN = 2
local NAME_MAX = 12
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
  -- Ascending (the shortest clear on top, then the longest runs not won), keeping each player's
  -- best; no reset; ranks on.
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
  local ok, account = pcall(nk.account_get_id, user_id)
  if not ok or account == nil then
    return ""
  end
  return account.user.display_name or ""
end

-- What makes two names the same one: case and spaces don't count.
local function name_key(name)
  return (name:lower():gsub("%s", ""))
end

-- Whether someone other than `user_id` has `name`: a claim since .97, or a display name from before
-- (compared the same way in the database, which lowers more than ASCII).
local function name_taken(name, user_id)
  local claims = nk.storage_read({ { collection = "names", key = name_key(name), user_id = SYSTEM_USER } })
  if claims[1] ~= nil and claims[1].value.user ~= user_id then
    return true
  end
  local rows = nk.sql_query("SELECT 1 FROM users WHERE lower(regexp_replace(display_name, '\\s', '', 'g')) = lower(regexp_replace($1, '\\s', '', 'g')) AND id <> $2::uuid LIMIT 1", { name, user_id })
  return #rows > 0
end

-- What's wrong with `name` for this player, or nil: its form (name_problem), or someone has it.
local function name_refusal(name, user_id)
  return name_problem(name) or (name_taken(name, user_id) and "taken" or nil)
end

local function name_check(context, payload)
  local problem = name_refusal(trim(tostring(decode(payload).name or "")), context.user_id)
  if problem ~= nil then
    return reply({ error = problem })
  end
  return reply({ ok = true })
end

local function set_name(context, payload)
  if display_name(context.user_id) ~= "" then
    return reply({ error = "has_name" })
  end
  local name = trim(tostring(decode(payload).name or ""))
  local problem = name_refusal(name, context.user_id)
  if problem ~= nil then
    return reply({ error = problem })
  end
  -- Written only if no one has claimed it (version "*"): of two taking it at once, one fails here.
  local claimed = pcall(nk.storage_write, { { collection = "names", key = name_key(name), user_id = SYSTEM_USER,
    value = { user = context.user_id, name = name }, version = "*", permission_read = 0, permission_write = 0 } })
  if not claimed then
    return reply({ error = "taken" })
  end
  nk.account_update_id(context.user_id, nil, nil, name, nil, nil, nil, nil)
  return reply({ ok = true, name = name })
end

-- What a record's score stands for: {ms, cleared}.
local function decoded(score)
  if score > MAX_MS then
    return SURVIVED_FROM - score, false
  end
  return score, true
end

local function own_record(map, user_id)
  local _, owner_records = nk.leaderboard_records_list(board_id(map), { user_id }, 1, nil, 0)
  return owner_records and owner_records[1] or nil
end

local function submit(context, payload)
  local entry = decode(payload)
  local map, ms, job = entry.map, tonumber(entry.ms), entry.job
  local cleared = entry.cleared ~= false
  local lowest = cleared and MIN_MS or SURVIVE_MIN_MS
  if not MAPS[map] or not JOBS[job] or ms == nil or ms < lowest or ms > MAX_MS then
    return reply({ error = "invalid" })
  end
  if display_name(context.user_id) == "" then
    return reply({ error = "no_name" })
  end
  local score = cleared and math.floor(ms) or SURVIVED_FROM - math.floor(ms)
  nk.leaderboard_record_write(board_id(map), context.user_id, nil, score, 0,
    { job = job, run = tostring(entry.run or "") })
  local record = own_record(map, context.user_id)
  local best_ms, best_cleared = decoded(record and record.score or score)
  return reply({ ok = true, rank = record and record.rank or 0, best_ms = best_ms, best_cleared = best_cleared })
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
  local function row(record)
    local name = names[record.owner_id] or ""
    if name == "" then
      name = HIDDEN_NAME
    end
    local metadata = record.metadata or {}
    local ms, cleared = decoded(record.score)
    return { rank = record.rank, user = record.owner_id, name = name, ms = ms, cleared = cleared,
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
nk.register_rpc(name_check, "survivors_name_check")
-- Nakama's own account update would set a display name past survivors_set_name's checks (unique,
-- once, blocked words); the game never calls it (.97), so it is turned away (a before hook
-- returning nil rejects the request).
nk.register_req_before(function(_context, _payload) return nil end, "UpdateAccount")
nk.register_rpc(feedback, "survivors_feedback")
