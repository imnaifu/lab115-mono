/* The loading page (.98, the user: 做个酷炫的加载页面): builds what loading.css draws into
   Godot's status overlay (#status) and keeps it moving with the download. Godot's shell writes
   the progress into its own <progress id="status-progress"> (value / max, no value while it
   doesn't know yet); this reads it back every frame, so nothing in the shell has to change.
   When the game starts, the shell removes #status and all of this with it. Loaded from the
   page's head (export_presets.cfg, html/head_include), before the body exists. */
(function () {
	var TEXT = {
		zh: {
			title: '大厂幸存者',
			tip: '小贴士',
			booting: '下载完了，正在开机…',
			tips: [
				'站进黄色的圈里满 10 秒就能打卡，加成永久有效',
				'地标在 1、3、5、7、9 分钟开门',
				'技能靠击杀充能，充满了点右上角就能放',
				'撑到 10:00 下班，清完场上的怪才算通关',
				'出发页能选无尽模式：10:00 后怪越来越多，比谁撑得久',
				'打掉 boss 开年终奖，发的工资拿去培训',
				'每局能刷新一次升级卡，培训能加次数',
				'星星走近就会自动吸过来，捡满就升级',
				'捡到珍珠奶茶回血，捡到午休所有怪都定住',
				'运气越高，越容易抽到稀有的升级卡',
				'在哪张地图打的卡，加成在每张地图都算'
			]
		},
		en: {
			title: 'Big Tech Survivors',
			tip: 'TIP',
			booting: 'Downloaded. Booting up…',
			tips: [
				'Stand in a yellow ring for 10 seconds to check in: the bonus is yours for good',
				'Landmarks open at 1, 3, 5, 7 and 9 minutes',
				'Kills charge your skill; tap the button top right when it\'s full',
				'Clock out at 10:00, then clear the floor to win',
				'Pick Endless on the way in: past 10:00 they keep coming, last the longest',
				'Beat a boss to open its year-end bonus, and spend the pay on Training',
				'One reroll of the level-up cards a run; Training adds more',
				'Walk close to stars and they fly to you; enough of them and you level up',
				'Bubble tea heals; a nap stops every enemy in its tracks',
				'The more Luck, the rarer the level-up cards',
				'A check-in\'s bonus counts on every map'
			]
		}
	};
	// The game's choice of language, mirrored to localStorage by Lang.apply; Chinese until the
	// player picks, as in the game.
	var language = 'zh';
	try {
		if (localStorage.getItem('survivors-language') === 'en') {
			language = 'en';
		}
	} catch (error) {}
	var text = TEXT[language];
	document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
	document.title = text.title;

	// Positions of the stars along the bar, as fractions of it.
	var STARS = [0.18, 0.36, 0.54, 0.72, 0.9];
	var TIP_SECONDS = 3.2;
	// How quickly the shown progress catches up with the real one, per frame: the shell's
	// reports come in steps, and the runners shouldn't jump.
	var EASE = 0.12;

	function element(tag, className, parent) {
		var node = document.createElement(tag);
		if (className) {
			node.className = className;
		}
		if (parent) {
			parent.appendChild(node);
		}
		return node;
	}

	function picture(name, className, parent) {
		var image = element('img', className, parent);
		image.src = 'loading/' + name + '.svg';
		image.alt = '';
		image.draggable = false;
		// Without the art (a local export without tools/export_web.sh), leave a gap, not a
		// broken image.
		image.onerror = function () {
			image.style.visibility = 'hidden';
		};
		return image;
	}

	function shuffled(list) {
		var copy = list.slice();
		for (var i = copy.length - 1; i > 0; i--) {
			var j = Math.floor(Math.random() * (i + 1));
			var held = copy[i];
			copy[i] = copy[j];
			copy[j] = held;
		}
		return copy;
	}

	function build() {
		var status = document.getElementById('status');
		var native = document.getElementById('status-progress');
		var notice = document.getElementById('status-notice');
		if (!status || !native) {
			return;
		}
		if (language === 'en') {
			status.classList.add('ld-en');
		}
		element('div', 'ld-blob ld-blob-sky', status);
		element('div', 'ld-blob ld-blob-mint', status);
		var page = element('div', 'ld');
		// Before the shell's notice, so a failure reads under the name.
		status.insertBefore(page, notice);

		var title = element('h1', 'ld-title', page);
		Array.prototype.forEach.call(text.title, function (character, index) {
			if (character === ' ') {
				element('span', 'ld-space', title);
				return;
			}
			var letter = element('span', 'ld-letter', title);
			letter.textContent = character;
			letter.style.setProperty('--i', index);
		});

		var race = element('div', 'ld-race', page);
		var course = element('div', 'ld-course', race);
		var lane = element('div', 'ld-lane', course);
		var stars = STARS.map(function (at) {
			var star = picture('star_gold', 'ld-star', lane);
			star.style.left = at * 100 + '%';
			star.style.animationDelay = -at * 2 + 's';
			return star;
		});
		var pack = element('div', 'ld-pack', lane);
		picture('bug', 'ld-runner', pack);
		picture('ping', 'ld-runner', pack);
		picture('ghost404', 'ld-runner ld-ghost', pack);
		var hero = element('div', 'ld-hero', pack);
		element('span', 'ld-puff', hero);
		element('span', 'ld-puff', hero);
		picture('coder', '', hero);
		var bar = element('div', 'ld-bar', course);
		element('div', 'ld-fill', bar);
		var percent = element('div', 'ld-pct', race);
		percent.textContent = '0%';

		var tip = element('div', 'ld-tip', page);
		var tips = shuffled(text.tips);
		var tipIndex = 0;
		var tipShownAt = performance.now();
		var booting = false;
		function showTip() {
			tip.innerHTML = '';
			element('b', '', tip).textContent = text.tip;
			tip.appendChild(document.createTextNode(tips[tipIndex % tips.length]));
		}
		showTip();

		var shown = 0;
		function frame(now) {
			// Gone once the game is up (the shell removes #status).
			if (!status.isConnected) {
				return;
			}
			if (notice && notice.style.display === 'block') {
				status.classList.add('ld-failed');
				return;
			}
			var max = native.hasAttribute('max') ? Number(native.max) : 0;
			var target = max > 0 && native.hasAttribute('value') ? Math.min(Number(native.value) / max, 1) : 0;
			shown += (target - shown) * EASE;
			if (target - shown < 0.001) {
				shown = target;
			}
			course.style.setProperty('--p', shown.toFixed(4));
			percent.textContent = Math.floor(shown * 100) + '%';
			stars.forEach(function (star, index) {
				if (shown >= STARS[index] && !star.classList.contains('ld-got')) {
					star.classList.add('ld-got');
				}
			});
			// All downloaded: the engine still has to compile and start, which takes a moment.
			if (target >= 1 && shown >= 0.999 && !booting) {
				booting = true;
				tip.textContent = text.booting;
				tip.classList.remove('ld-fade');
			}
			if (!booting && now - tipShownAt > TIP_SECONDS * 1000) {
				tipShownAt = now;
				// Out, swap, back in (the fade is loading.css's transition).
				tip.classList.add('ld-fade');
				setTimeout(function () {
					if (booting) {
						return;
					}
					tipIndex += 1;
					showTip();
					tip.classList.remove('ld-fade');
				}, 250);
			}
			requestAnimationFrame(frame);
		}
		requestAnimationFrame(frame);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', build);
	} else {
		build();
	}
}());
