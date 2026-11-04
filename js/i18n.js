// Arabic is the default language; English is one tap away on the flag button.
const STR = {
  ar: {
    title: 'اركض يا عبود!',
    kicker: 'بابا وراك على طول!',
    s_shouts: ['تعال هنيه!', 'يا ولد!', 'وقّف يا عبود!', 'وين رايح؟!', 'والله لأعلّمك!', 'عبوووود!', 'ارجع البيت!'],
    s_taunts: ['ما تلحقني!', 'بابا تعبت؟', 'هههه!', 'مب أنا!', 'يلا بابا!'],
    s_throw: ['خذ هذي!', 'النعال!', 'شوف هذا!'], s_hit: ['قرّبت منك!', 'هههه!', 'شوي شوي!'], s_scared: ['آسف بابا!', 'لا لا لا!', 'ماما!'],
    s_come: 'تعال هنيه!', s_slip: 'آآآخ! كرات!', s_phone: 'هلا أم عبود…', s_yay: 'ييييه!', s_scoot: 'باي باي بابا!',
    s_got: 'مسكتك!', s_fell: 'طحت يا ولد!', s_sorry: 'آسف بابا!', phoneScreen: 'ماما',
    area: n => `المنطقة ${n}`,
    story: 'عبود سوّى حركة جديدة! وبابا وراه على طول، غترته معوجّة والنعال في يده. اركض في الفريج والسوق والكورنيش لين توصل البر.',
    it_vimto: 'فيمتو', it_vimto_d: 'عبود يركض أسرع',
    it_marbles: 'كرات زجاج', it_marbles_d: 'بابا يتزحلق ويطيح',
    it_phone: 'ماما تتصل', it_phone_d: 'بابا يوقف يرد عليها',
    it_scooter: 'سكوتر', it_scooter_d: 'يكسّر كل شي قدامه',
    it_magnet: 'مغناطيس', it_magnet_d: 'يجذب الحلاوة',
    it_sandal: 'النعال الطاير', it_sandal_d: 'انقز لما تشوف «!» فوق بابا',
    start: 'يلا اركض!',
    hint: 'المس الشاشة أو اضغط مسافة للقفز. المس مرة ثانية وانت في الهوا عشان تتشقلب، وطوّل الضغطة لقفزة أعلى.',
    ios: 'للّعب بملء الشاشة: اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية».',
    rotate: 'لفّ التلفون بالعرض عشان تشوف أكثر',
    fullscreen: 'ملء الشاشة',
    best: m => `أفضل مسافة لك: ${m} م`,
    caught: 'انمسك عبود!', fell: 'طاح في الحفرة!',
    caughtMsg: 'بابا مسك عبود من ظهر الكندورة.', fellMsg: 'عبود طاح في حفرة وبابا طلّعه منها.',
    newBest: 'رقم قياسي جديد!', beat: m => `حاول تتعدى ${m} م.`,
    sMetres: 'متر', sBest: 'الأفضل', sSweets: 'حلاوة', sClose: 'نجاة بأعجوبة',
    again: 'اركض مرة ثانية', againHint: 'المس الشاشة أو اضغط مسافة للعب مرة ثانية',
    sec: ' ث', m: 'م', sweets: 'حلاوة', baba: 'بابا', abood: 'عبود',
    c_vimto: 'فيمتو', c_scooter: 'سكوتر', c_magnet: 'مغناطيس', c_slip: 'بابا يتزحلق', c_phone: 'على التلفون',
    f_smash: 'تكسير!', f_close: 'نجوت!', f_jar: n => `+${n} حلاوة!`, f_combo: n => `كومبو ×${n}`,
    f_vimto: 'قوة الفيمتو!', f_slip: 'بابا تزحلق!', f_phone: 'ماما تتصل!', f_magnet: 'مغناطيس الحلاوة!', f_scooter: 'سكوتر!',
    paused: 'إيقاف مؤقت', pausedHint: 'المس الشاشة أو اضغط P للمتابعة',
    loading: 'جاري التحميل…', ready: 'جاهز!',
    ld_fonts: 'نجهّز الخطوط…', ld_sound: 'نجهّز الأصوات…', ld_art: 'نرسم عبود وبابا…', ld_cache: 'نحفظ اللعبة للعب بدون نت…',
    tips: ['نصيحة: الكرات الزجاج تخلي بابا يتزحلق ٤ ثواني.', 'نصيحة: لما تطلع «!» فوق بابا، النعال جاي! انقز.', 'نصيحة: كل ١٠ حلاوات تبعدك عن بابا شوي.', 'نصيحة: القفزة الثانية في الهوا تنقذك من الحفر الكبيرة.'],
    update: 'نسخة جديدة من اللعبة جاهزة', updateBtn: 'حدّث',
    langName: 'English', langAria: 'Switch to English',
    pause: 'إيقاف مؤقت', sound: 'الصوت والموسيقى',
  },
  en: {
    title: 'Run, Abood!',
    kicker: 'Baba is right behind you!',
    s_shouts: ['Come here!', 'Hey, boy!', 'Stop, Abood!', 'Where are you going?!', 'Wait till I catch you!', 'Abooood!', 'Home, now!'],
    s_taunts: ["Can't catch me!", 'Tired, Baba?', 'Hehehe!', "Wasn't me!", 'Come on, Baba!'],
    s_throw: ['Take this!', 'The sandal!', 'Watch this!'], s_hit: ["I'm gaining!", 'Ha ha!', 'Not so fast!'], s_scared: ['Sorry, Baba!', 'No no no!', 'Mama!'],
    s_come: 'Come here!', s_slip: 'Whoa! Marbles!', s_phone: 'Hello, Umm Abood…', s_yay: 'Yaaay!', s_scoot: 'Bye bye, Baba!',
    s_got: 'Got you!', s_fell: 'You fell, boy!', s_sorry: 'Sorry, Baba!', phoneScreen: 'Mama',
    area: n => `Area ${n}`,
    story: 'Abood got up to mischief again. Baba is right behind him, ghutra knocked crooked and a sandal in his hand. Run through the fareej, the souq, the corniche and out into the desert.',
    it_vimto: 'Vimto', it_vimto_d: 'Abood runs faster',
    it_marbles: 'Marbles', it_marbles_d: 'Baba slips and flails',
    it_phone: 'Mama calls', it_phone_d: 'Baba stops to answer',
    it_scooter: 'Scooter', it_scooter_d: 'Smash through anything',
    it_magnet: 'Magnet', it_magnet_d: 'Pulls in nearby sweets',
    it_sandal: 'Flying sandal', it_sandal_d: 'Jump when Baba shows “!”',
    start: 'Start running',
    hint: 'Tap or press Space to jump. Tap again in the air to flip. Hold for a higher jump.',
    ios: 'To play full screen: tap Share, then “Add to Home Screen”.',
    rotate: 'Turn your phone sideways to see more',
    fullscreen: 'Full screen',
    best: m => `Your best run: ${m} m`,
    caught: 'Caught!', fell: 'Into the hole!',
    caughtMsg: 'Baba grabbed Abood by the back of his kandura.', fellMsg: 'Abood fell into a hole and Baba scooped him right out.',
    newBest: 'New best run!', beat: m => `Try to beat ${m} m.`,
    sMetres: 'metres', sBest: 'best', sSweets: 'sweets', sClose: 'close calls',
    again: 'Run again', againHint: 'Tap or press Space to run again',
    sec: 's', m: 'm', sweets: 'sweets', baba: 'Baba', abood: 'Abood',
    c_vimto: 'Vimto', c_scooter: 'Scooter', c_magnet: 'Magnet', c_slip: 'Baba slipping', c_phone: 'On the phone',
    f_smash: 'Smash!', f_close: 'Close one!', f_jar: n => `+${n} sweets!`, f_combo: n => `Combo x${n}`,
    f_vimto: 'Vimto power!', f_slip: 'Baba slips!', f_phone: 'Mama is calling!', f_magnet: 'Sweet magnet!', f_scooter: 'Scooter!',
    paused: 'Paused', pausedHint: 'Tap or press P to keep running',
    loading: 'Loading…', ready: 'Ready!',
    ld_fonts: 'Loading fonts…', ld_sound: 'Building sounds…', ld_art: 'Drawing Abood and Baba…', ld_cache: 'Saving the game for offline play…',
    tips: ['Tip: marbles make Baba slip for 4 seconds.', 'Tip: when “!” appears over Baba, a sandal is coming. Jump!', 'Tip: every 10 sweets push Baba back a little.', 'Tip: the double jump saves you over wide holes.'],
    update: 'A new version of the game is ready', updateBtn: 'Update',
    langName: 'العربية', langAria: 'التبديل إلى العربية',
    pause: 'Pause', sound: 'Sound and music',
  },
};

// Flags shown on the switch: the flag of the language you would switch TO.
const FLAG = {
  en: '<svg viewBox="0 0 60 30" aria-hidden="true"><clipPath id="ukS"><path d="M0,0v30h60V0z"/></clipPath><clipPath id="ukT"><path d="M30,15h30v15zv15H0zH0V0zV0h30z"/></clipPath><g clip-path="url(#ukS)"><path d="M0,0v30h60V0z" fill="#012169"/><path d="M0,0L60,30M60,0L0,30" stroke="#fff" stroke-width="6"/><path d="M0,0L60,30M60,0L0,30" clip-path="url(#ukT)" stroke="#C8102E" stroke-width="4"/><path d="M30,0v30M0,15h60" stroke="#fff" stroke-width="10"/><path d="M30,0v30M0,15h60" stroke="#C8102E" stroke-width="6"/></g></svg>',
  ar: '<svg viewBox="0 0 12 6" aria-hidden="true"><rect width="12" height="2" fill="#00732f"/><rect y="2" width="12" height="2" fill="#fff"/><rect y="4" width="12" height="2" fill="#000"/><rect width="3" height="6" fill="#ff0000"/></svg>',
};

let lang = 'ar';
try { const s = localStorage.getItem('abood-lang'); if (s === 'en' || s === 'ar') lang = s; } catch (e) {}
const listeners = [];

export const getLang = () => lang;
export function T(key, ...args) {
  const v = STR[lang][key] ?? STR.en[key] ?? key;
  return typeof v === 'function' ? v(...args) : v;
}
export function onLang(fn) { listeners.push(fn); }
export function applyLang() {
  const root = document.documentElement;
  root.lang = lang; root.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.title = lang === 'ar' ? 'اركض يا عبود!' : 'Run, Abood!';
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = T(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', T(el.dataset.i18nAria)); });
  const other = lang === 'ar' ? 'en' : 'ar';
  document.querySelectorAll('.lang').forEach(b => {
    b.innerHTML = FLAG[other] + '<span>' + T('langName') + '</span>';
    b.setAttribute('aria-label', T('langAria'));
    b.lang = other;
  });
  listeners.forEach(fn => fn(lang));
}
export function setLang(l) {
  lang = l; try { localStorage.setItem('abood-lang', l); } catch (e) {}
  applyLang();
}
export function toggleLang() { setLang(lang === 'ar' ? 'en' : 'ar'); }
