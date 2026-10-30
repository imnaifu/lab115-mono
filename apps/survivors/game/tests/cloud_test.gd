extends SceneTree
## Checks the cloud save (Cloud) against a Nakama server: two devices merging their progress
## through a 存档码, deleting the cloud save, and quiet failure with no server. Progress stays in
## memory and the devices' ids too, so the save and device id of the game on this machine are
## left alone. Also checks Progress.merge_text's rules on their own. Exits with code 1 on a failure.
##
##   godot --headless --path . -s tests/cloud_test.gd                   # local server (Cloud.LOCAL)
##   godot --headless --path . -s tests/cloud_test.gd -- --cloud=<url>  # another one
##
## The local server is docker-compose.yml's nakama service (README.md, 「云存档」).

const WAIT_SECONDS := 20.0

var _failures := PackedStringArray()


func _initialize() -> void:
	Progress.to_disk = false
	_run.call_deferred()


func _run() -> void:
	_check_merge_rules()
	var url := Cloud.LOCAL
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--cloud="):
			url = arg.get_slice("=", 1)
	await _check_two_devices(url)
	await _check_no_server()
	if _failures.is_empty():
		print("[cloud] all checks passed")
		quit(0)
	else:
		printerr("[cloud] FAIL:\n  " + "\n  ".join(_failures))
		quit(1)


func _check(ok: bool, what: String) -> void:
	print("[cloud] %s %s" % ["ok  " if ok else "FAIL", what])
	if not ok:
		_failures.append(what)


func _check_merge_rules() -> void:
	Progress.reset()
	Progress._load().set_value("stamps", "golden_gate", 200)
	Progress._load().set_value("stats", "runs", 3)
	Progress._load().set_value("stats", "bosses", ["layoff"])
	Progress._load().set_value("stats", "wins", {"coder": 1})
	var other := ConfigFile.new()
	other.set_value("stamps", "golden_gate", 100)
	other.set_value("stamps", "hoover_tower", 300)
	other.set_value("stats", "runs", 2)
	other.set_value("stats", "bosses", ["layoff", "incident"])
	other.set_value("stats", "wins", {"coder": 4, "pm": 1})
	other.set_value("from_a_newer_build", "anything", "kept")
	_check(Progress.merge_text(other.encode_to_text()), "merge reports a change")
	_check(Progress._load().get_value("stamps", "golden_gate") == 100, "merge keeps a stamp's earliest time")
	_check(Progress.has_stamp("hoover_tower"), "merge adds the other copy's stamps")
	_check(Progress.stat("runs", 0) == 3, "merge keeps the larger count")
	_check(Progress.stat("bosses", []) == ["layoff", "incident"], "merge unites sets")
	_check(Progress.stat("wins", {}) == {"coder": 4, "pm": 1}, "merge takes the larger count per key")
	_check(Progress._load().get_value("from_a_newer_build", "anything", "") == "kept", "merge keeps sections it doesn't know")
	_check(not Progress.merge_text(other.encode_to_text()), "merging the same copy again changes nothing")


## Device A plays, makes a 存档码; device B, with progress of its own, enters it. Both devices
## share one Progress here (it's static), so B's progress is put in place before B starts.
func _check_two_devices(url: String) -> void:
	Progress.reset()
	Progress.add_stamp("golden_gate")
	Progress.add_achievement("first_day")
	Progress.set_stat("runs", 3)
	Progress.set_stat("bosses", ["layoff"])
	var device_a := await _device(url)
	_check(device_a.status == Cloud.Status.SYNCED, "device A connects and uploads (status %s)" % Cloud.STATUS_NAMES[device_a.status])
	var code_a: String = await device_a.ensure_code()
	_check(code_a.length() == Cloud.CODE_LENGTH, "device A gets a 存档码 (%s)" % Cloud.format_code(code_a))
	_check((await device_a.ensure_code()) == code_a, "asking again gives the same code")

	# A save on A goes up by itself a moment later.
	Cloud._instance = device_a
	Progress.add_stamp("hoover_tower")
	await create_timer(Cloud.UPLOAD_DELAY + 0.5).timeout
	await _wait(func() -> bool: return not device_a._syncing, device_a)
	_check((await _read_cloud(device_a)).contains("hoover_tower"), "a save on device A is uploaded")
	Cloud._instance = null

	Progress.reset()
	Progress.add_stamp("bj_nest")
	Progress.set_stat("runs", 5)
	Progress.set_stat("bosses", ["fubao"])
	var device_b := await _device(url)
	var old_device_id: String = device_b._config.get_value("cloud", "device_id", "")
	_check(device_b.status == Cloud.Status.SYNCED, "device B connects with an account of its own")
	_check((await device_b.redeem("abc")) == Cloud.Redeem.INVALID, "a malformed code is refused before asking the server")
	_check((await device_b.redeem("ZZZZ-ZZZZ-ZZZZ")) == Cloud.Redeem.NOT_FOUND, "an unknown code is not found")
	var typed := Cloud.format_code(code_a).to_lower()
	_check((await device_b.redeem(typed)) == Cloud.Redeem.OK, "device B takes device A's code (typed in lower case)")
	_check(device_b.code == code_a, "device B now shows A's code")
	_check(Progress.has_stamp("golden_gate") and Progress.has_stamp("hoover_tower") and Progress.has_stamp("bj_nest"), "device B has both devices' stamps")
	_check(Progress.stat("runs", 0) == 5, "device B keeps the larger run count")
	_check(Progress.stat("bosses", []).size() == 2, "device B has both devices' bosses")
	var cloud_text := await _read_cloud(device_a)
	_check(cloud_text.contains("bj_nest"), "the merged save is in the cloud for device A too")
	# Nothing is deleted on the server: the account B had on its own is kept, marked as merged.
	var left_behind := await _state_of(device_b, old_device_id)
	_check(left_behind.get("reason") == "redeemed" and left_behind.get("into") == device_b._session.user_id,
		"device B's own codeless account is kept, marked as merged into A's (%s)" % left_behind)

	var shared_device_id: String = device_a._config.get_value("cloud", "device_id", "")
	_check(await device_b.delete_account(), "device B deletes the cloud save")
	_check(device_b.status == Cloud.Status.DISABLED and device_b.code.is_empty(), "the cloud save is off after deleting, with no code")
	_check((await device_b.redeem(code_a)) == Cloud.Redeem.NOT_FOUND, "the deleted account's code is gone")
	_check(Progress.has_stamp("bj_nest") and Progress.has_stamp("golden_gate"), "deleting keeps the progress on the device")
	var deleted := await _state_of(device_b, shared_device_id)
	_check(deleted.get("reason") == "player" and deleted.has("deleted"), "the deleted account is kept on the server, marked (%s)" % deleted)
	_check((await _read_cloud(device_a)).contains("bj_nest"), "the deleted account's save is still on the server")
	var deleted_user := device_a._session.user_id
	device_a._set_session(null)
	await device_a._start()
	_check(device_a.status == Cloud.Status.SYNCED and device_a._session.user_id != deleted_user, "device A, on the deleted account, gets a fresh one when it next connects")
	_check(device_a.code.is_empty(), "device A forgets the deleted account's code")
	_check((await _read_cloud(device_a)).contains("bj_nest"), "device A uploads its progress to the fresh account")
	device_b.enable()
	await _wait(func() -> bool: return device_b.status == Cloud.Status.SYNCED, device_b)
	_check(device_b.status == Cloud.Status.SYNCED and device_b.code.is_empty(), "turning it back on starts a fresh account")
	device_a.queue_free()
	device_b.queue_free()


func _check_no_server() -> void:
	var device := await _device("http://127.0.0.1:9")
	_check(device.status == Cloud.Status.OFFLINE, "no server: offline, quietly")
	_check((await device.redeem("ABCD-EFGH-JKLM")) == Cloud.Redeem.OFFLINE, "no server: entering a code says offline")
	_check((await device.ensure_code()) == "", "no server: no code")
	device.queue_free()


## A device: a Cloud of its own (its id in memory), connected or given up.
func _device(url: String) -> Cloud:
	Cloud.server_override = url
	var device := Cloud.new()
	root.add_child(device)
	await _wait(func() -> bool: return device.status != Cloud.Status.CONNECTING and device.status != Cloud.Status.OFF, device)
	return device


func _wait(done: Callable, device: Cloud) -> void:
	var deadline := Time.get_ticks_msec() + WAIT_SECONDS * 1000.0
	while not done.call() and Time.get_ticks_msec() < deadline:
		await process_frame
	# A sync may still be running (its last write).
	while device._syncing and Time.get_ticks_msec() < deadline:
		await process_frame


## What the cloud holds for a device's account.
func _read_cloud(device: Cloud) -> String:
	await device._sign_in()
	var read: NakamaAPI.ApiStorageObjects = await device._client.read_storage_objects_async(device._session,
		[NakamaStorageObjectId.new(Cloud.COLLECTION, Cloud.KEY, device._session.user_id)])
	return "" if read.is_exception() or read.objects.is_empty() else (read.objects[0] as NakamaAPI.ApiStorageObject).value


## The deletion mark (Cloud.STATE_COLLECTION) of the account a device id signs in to, {} if none.
func _state_of(device: Cloud, device_id: String) -> Dictionary:
	var session := await device._client.authenticate_device_async(device_id, null, false)
	if session.is_exception():
		return {}
	var read: NakamaAPI.ApiStorageObjects = await device._client.read_storage_objects_async(session,
		[NakamaStorageObjectId.new(Cloud.STATE_COLLECTION, Cloud.STATE_KEY, session.user_id)])
	if read.is_exception() or read.objects.is_empty():
		return {}
	var value: Variant = JSON.parse_string((read.objects[0] as NakamaAPI.ApiStorageObject).value)
	return value if value is Dictionary else {}
