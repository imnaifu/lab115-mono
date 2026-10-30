class_name Cloud
extends Node
## 云存档: the player's 局外成长 (Progress) kept on the game's own Nakama server as well, so that
## clearing the browser's data (WeChat's in-app browser does it on its own), a new phone or, later,
## the App don't lose it. Nobody signs up: the first launch makes an anonymous account for this
## device (a random device id), and a 存档码, a second key to the same account shown on the 收藏
## page's 存档 tab, brings that account to another device, where both sides' progress is merged.
##
## One instance hangs off the scene tree's root (like Sound), because the game scene is rebuilt
## for every run. It connects when the title screen first comes up, merges the server's copy into
## the local save and writes the result back; after that, every Progress save is uploaded a
## moment later. Every failure is quiet: the local save is still the one the game plays from, and
## the next save or launch tries again.
##
## Only on survivors.lab115.com, against a local server on a local export (localhost), or with
## --cloud=local / --cloud=<url>; never in the smoke test. How later sign-ins (Game Center, Google
## Play Games) and purchases fit onto these accounts: DESIGN.md 2.11.

enum Status { OFF, CONNECTING, SYNCED, OFFLINE, DISABLED }
enum Redeem { OK, INVALID, NOT_FOUND, OFFLINE }

## run_start's `cloud` (Telemetry): one per Status.
const STATUS_NAMES := ["off", "connecting", "synced", "offline", "disabled"]
## Not a secret, it ships in the game: it only has to match the server's --socket.server_key
## (docker-compose.yml).
const SERVER_KEY := "survivors-lab115"
const PRODUCTION := "https://nakama.lab115.com:443"
## docker-compose's nakama service run on this machine (README.md, 「云存档」).
const LOCAL := "http://127.0.0.1:7350"
const PATH := "user://cloud.cfg"
## One object per player holding the whole save, readable and writable by its owner only
## (permission 1). Nothing a client writes may ever decide what's unlocked: purchases, once there
## are any, are the stores' and the server's to say.
const COLLECTION := "progress"
const KEY := "main"
const OWNER_ONLY := 1
## A 存档码 is 12 characters out of 32, 0 / O and 1 / I left out so nothing gets misread when
## it's copied by hand: 60 bits, far too many to guess. Shown in groups of four.
const CODE_ALPHABET := "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
const CODE_LENGTH := 12
const HEX := "0123456789abcdef"
## Saves come in bursts (a landmark, an achievement, then the run's totals): one upload covers them.
const UPLOAD_DELAY := 2.0
const TIMEOUT_SECONDS := 10
## Rounds of read, merge, write when another device writes in between.
const WRITE_TRIES := 3

## The status changed, or the cloud's copy brought progress this device didn't have
## (`progress_merged`), which the screens showing it redraw for.
signal changed(progress_merged: bool)

## A server that wins over the usual choice (the cloud test).
static var server_override := ""
static var _instance: Cloud

var status := Status.OFF
## This account's 存档码 as last seen, "" while it has none.
var code := ""
var _client: NakamaClient
var _session: NakamaSession
var _config := ConfigFile.new()
var _timer: Timer
var _syncing := false
## A save came in while a sync was running: another one follows.
var _pending := false


## Starts the cloud save, once per page load (the game scene calls it every time it's built).
static func setup() -> void:
	if _instance != null:
		return
	_instance = Cloud.new()
	_instance.name = "Cloud"
	# Deferred: called from the game scene's _ready, while the root refuses new children.
	(Engine.get_main_loop() as SceneTree).root.add_child.call_deferred(_instance)


## The instance for the 存档 tab; null before setup (scripts run without the game scene).
static func shared() -> Cloud:
	return _instance


## Progress was saved: upload it shortly.
static func save_changed() -> void:
	if _instance != null:
		_instance._schedule_upload()


static func status_name() -> String:
	return STATUS_NAMES[_instance.status] if _instance != null else STATUS_NAMES[Status.OFF]


## A 存档码 as shown: K7Q2-M9XA-3PLR.
static func format_code(value: String) -> String:
	var groups := PackedStringArray()
	for i in range(0, value.length(), 4):
		groups.append(value.substr(i, 4))
	return "-".join(groups)


## What was typed or pasted, down to the code's own characters: lower case, dashes and spaces
## don't matter.
static func normalize_code(text: String) -> String:
	var kept := ""
	for letter in text.to_upper():
		if CODE_ALPHABET.contains(letter):
			kept += letter
	return kept


func _ready() -> void:
	# The title screen pauses the tree, and that's when the first sync runs.
	process_mode = Node.PROCESS_MODE_ALWAYS
	var url := _server_url()
	if url.is_empty():
		return
	if Progress.to_disk:
		_config.load(PATH)
	_timer = Timer.new()
	_timer.one_shot = true
	_timer.timeout.connect(_sync)
	add_child(_timer)
	var adapter := NakamaHTTPAdapter.new()
	# Silent: the page reports anything the engine prints as an error (js_error), and a phone
	# without a connection is no error. Failures are handled here instead.
	adapter.logger = NakamaLogger.new("Nakama", NakamaLogger.LOG_LEVEL.NONE)
	add_child(adapter)
	var scheme := url.get_slice("://", 0)
	var address := url.get_slice("://", 1)
	var port := int(address.get_slice(":", 1)) if address.contains(":") else (443 if scheme == "https" else 80)
	_client = NakamaClient.new(adapter, SERVER_KEY, scheme, address.get_slice(":", 0), port, TIMEOUT_SECONDS)
	code = _config.get_value("cloud", "code", "")
	if _config.get_value("cloud", "disabled", false):
		status = Status.DISABLED
		return
	_start()


## This device's account's 存档码, made the first time it's asked for; "" when the server
## can't be reached.
func ensure_code() -> String:
	if not code.is_empty():
		return code
	if not await _sign_in():
		return ""
	var fresh := _random_text(CODE_ALPHABET, CODE_LENGTH)
	if (await _client.link_custom_async(_session, fresh)).is_exception():
		return ""
	_remember_code(fresh)
	return code


## Moves this device onto the account a 存档码 (`text`) belongs to and merges this device's
## progress into it. The account the device had before is deleted unless its own 存档码 was
## ever made (the player may have that written down for another device).
func redeem(text: String) -> Redeem:
	var entered := normalize_code(text)
	if entered.length() != CODE_LENGTH:
		return Redeem.INVALID
	if _client == null:
		return Redeem.OFFLINE
	var session := await _client.authenticate_custom_async(entered, null, false)
	if session.is_exception():
		return Redeem.NOT_FOUND if session.get_exception().status_code == 404 else Redeem.OFFLINE
	if _session == null or session.user_id != _session.user_id:
		# A device id of its own on that account: the old one stays with the old account.
		var device_id := _random_text(HEX, 32)
		if (await _client.link_device_async(session, device_id)).is_exception():
			return Redeem.OFFLINE
		if _session != null and code.is_empty():
			# Waited for, so it's gone by the time the player sees the result; a failure only
			# leaves an empty account behind.
			await _client.delete_account_async(_session)
		_session = session
		_config.set_value("cloud", "device_id", device_id)
	# Entering a code turns the cloud save back on if it was off.
	_config.set_value("cloud", "disabled", null)
	_remember_code(entered)
	await _sync()
	return Redeem.OK


## Deletes this device's account on the server, with its copy of the save and its 存档码, and
## stops syncing on this device until the player turns it on again. The local save stays. Other
## devices that were on the account get a fresh one of their own when they next connect (_start).
func delete_account() -> bool:
	if not await _sign_in():
		return false
	if (await _client.delete_account_async(_session)).is_exception():
		return false
	_session = null
	code = ""
	# A fresh anonymous account if it's turned on again.
	_config.set_value("cloud", "device_id", null)
	_config.set_value("cloud", "code", null)
	_config.set_value("cloud", "disabled", true)
	_save_config()
	_set_status(Status.DISABLED)
	return true


## Turns the cloud save back on after delete_account.
func enable() -> void:
	if _client == null:
		return
	_config.set_value("cloud", "disabled", null)
	_save_config()
	_start()


static func _server_url() -> String:
	if not server_override.is_empty():
		return server_override
	# The smoke test keeps progress in memory; it has nothing to upload.
	if not Progress.to_disk:
		return ""
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--cloud="):
			var value := arg.get_slice("=", 1)
			return LOCAL if value == "local" else value
	if OS.has_feature("web"):
		var host: Variant = JavaScriptBridge.eval("location.hostname", true)
		if host == "survivors.lab115.com":
			return PRODUCTION
		if host == "localhost" or host == "127.0.0.1":
			return LOCAL
	return ""


func _start() -> void:
	_set_status(Status.CONNECTING)
	if not await _sign_in():
		_set_status(Status.OFFLINE)
		return
	# The code this device remembers may be gone: when another device on the account deleted it,
	# signing in with this device's id made a fresh account, with no code yet.
	var account: NakamaAPI.ApiAccount = await _client.get_account_async(_session)
	if not account.is_exception() and account.custom_id != code:
		_remember_code(account.custom_id)
	await _sync()


## A session for this device's account, signing in again when the last one is about to run out.
func _sign_in() -> bool:
	if _client == null:
		return false
	if _session != null and _session.is_valid() and not _session.would_expire_in(60):
		return true
	var device_id: String = _config.get_value("cloud", "device_id", "")
	if device_id.is_empty():
		device_id = _random_text(HEX, 32)
		_config.set_value("cloud", "device_id", device_id)
		_save_config()
	var session := await _client.authenticate_device_async(device_id)
	if session.is_exception():
		return false
	_session = session
	return true


func _schedule_upload() -> void:
	if _client == null or status == Status.DISABLED:
		return
	if _syncing:
		_pending = true
		return
	_timer.start(UPLOAD_DELAY)


## Merges the cloud's copy into the local save and writes the result back, reading again when
## another device wrote in between (the write names the version it read). Sets the status from
## how it went.
func _sync() -> void:
	if _syncing:
		_pending = true
		return
	_syncing = true
	_pending = false
	var done := false
	var merged := false
	if await _sign_in():
		for i in WRITE_TRIES:
			var read: NakamaAPI.ApiStorageObjects = await _client.read_storage_objects_async(_session,
				[NakamaStorageObjectId.new(COLLECTION, KEY, _session.user_id)])
			if read.is_exception():
				break
			# "*" writes only if there's still nothing there.
			var version := "*"
			var remote := ""
			if not read.objects.is_empty():
				var object: NakamaAPI.ApiStorageObject = read.objects[0]
				version = object.version
				var value: Variant = JSON.parse_string(object.value)
				if value is Dictionary:
					remote = str(value.get("cfg", ""))
				if Progress.merge_text(remote):
					merged = true
			var text := Progress.to_text()
			if text == remote:
				done = true
				break
			var payload := JSON.stringify({"cfg": text, "version": Telemetry.VERSION})
			var write: NakamaAPI.ApiStorageObjectAcks = await _client.write_storage_objects_async(_session,
				[NakamaWriteStorageObject.new(COLLECTION, KEY, OWNER_ONLY, OWNER_ONLY, payload, version)])
			if not write.is_exception():
				done = true
				break
			# Most likely the version check: read what the other device wrote and merge again.
	_syncing = false
	_set_status(Status.SYNCED if done else Status.OFFLINE, merged)
	if _pending:
		_schedule_upload()


func _set_status(value: Status, progress_merged: bool = false) -> void:
	if value == status and not progress_merged:
		return
	status = value
	changed.emit(progress_merged)


func _remember_code(value: String) -> void:
	code = value
	_config.set_value("cloud", "code", value if not value.is_empty() else null)
	_save_config()


func _save_config() -> void:
	if Progress.to_disk:
		_config.save(PATH)


static func _random_text(alphabet: String, length: int) -> String:
	# The alphabets are 16 or 32 characters, so a byte's low bits pick one evenly.
	var bytes := Crypto.new().generate_random_bytes(length)
	var text := ""
	for byte in bytes:
		text += alphabet[byte % alphabet.length()]
	return text
