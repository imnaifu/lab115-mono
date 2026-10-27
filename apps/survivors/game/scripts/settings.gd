class_name Settings
extends RefCounted
## Player preferences that outlive a run: the language and whether tilting the phone steers.
## Saved to user://settings.cfg, which the web build keeps in the browser's IndexedDB.

const PATH := "user://settings.cfg"
const SECTION := "general"

static var _config: ConfigFile


static func get_value(key: String, default: Variant) -> Variant:
	return _load().get_value(SECTION, key, default)


static func set_value(key: String, value: Variant) -> void:
	_load().set_value(SECTION, key, value)
	_config.save(PATH)


static func _load() -> ConfigFile:
	if _config == null:
		_config = ConfigFile.new()
		# A missing file on first launch is expected; defaults apply until something is saved.
		_config.load(PATH)
	return _config
