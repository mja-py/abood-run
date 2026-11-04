const nf = n => (typeof n === 'string' && n[0] === '+') ? '+' + nf(n.slice(1)) : Number(n).toLocaleString('en-US');
// Arabic is the default language; English is one tap away on the flag button.
const STR = {
  ar: {
    title: 'اركض يا عبود!',
    kicker: 'بابا وراك على طول!',
    cur: 'د.إ', coins: n => `${nf(n)} د.إ`,
    b_wardrobe: 'الخزانة', b_shop: 'المحل', b_badges: 'الأوسمة', b_missions: 'المهمات', b_help: 'طريقة اللعب', b_close: 'إغلاق', b_menu: 'القائمة',
    boostersTitle: 'معززات هالجولة', noBoosters: 'اشتر معززات من المحل عشان تبدأ أقوى.',
    ch_abood: 'عبود',
    r_white: 'أبيض', r_cream: 'كريمي', r_grey: 'رمادي', r_blue: 'سماوي', r_brown: 'بني شتوي', r_gold: 'ذهبي',
    h_shemagh: 'شماغ أحمر', h_ghutra: 'غترة بيضاء', h_blackshemagh: 'شماغ أسود', h_tagiyah: 'طاقية',
    w_title: 'الخزانة', w_avatar: 'شكل عبود', av_classic: 'الأصلي', av_glasses: 'بنظارة', av_shades: 'بنظارة شمسية', w_robes: 'لون الكندورة', w_heads: 'غطاء الراس',
    buy: n => `اشتر · ${nf(n)} د.إ`, wear: 'البس', wearing: 'لابسه', choose: 'اختر', chosen: 'مختار', badgeOnly: 'ينفتح بوسام', notEnough: 'ما عندك دراهم كفاية', bought: 'تم الشراء!', have: n => `عندك ${n}`,
    shopTitle: 'المحل', shopNote: 'دراهم داخل اللعبة فقط، للتجربة. ما في دفع حقيقي.',
    bo_vimto: 'فيمتو البداية', bo_vimto_d: 'تبدأ الجولة أسرع ٦ ثواني', bo_magnet: 'مغناطيس البداية', bo_magnet_d: 'يجذب الحلاوة أول ١٠ ثواني',
    bo_headstart: 'انطلاقة قوية', bo_headstart_d: 'سكوتر من البداية ومسافة أبعد عن بابا', bo_shield: 'درع', bo_shield_d: 'يحميك من أول صدمة',
    bo_revive: 'فرصة ثانية', bo_revive_d: 'أول فرصة في كل جولة مجانية، وهذي للمرات اللي بعدها',
    bg_title: 'الأوسمة', bg_count: (a, b) => `${a} من ${b}`, bg_locked: 'مقفل', bg_reward: n => `+${nf(n)} د.إ`,
    bg_first: 'أول جولة', bg_first_d: 'العب جولة وحدة', bg_dist500: '٥٠٠ متر', bg_dist500_d: 'اركض ٥٠٠ م في جولة', bg_dist1000: '١٠٠٠ متر', bg_dist1000_d: 'اركض ١٠٠٠ م في جولة',
    bg_dist2000: '٢٠٠٠ متر', bg_dist2000_d: 'اركض ٢٠٠٠ م في جولة', bg_dist5000: '٥٠٠٠ متر', bg_dist5000_d: 'اركض ٥٠٠٠ م في جولة', bg_dist10000: 'عدّاء الإمارات', bg_dist10000_d: 'اركض ١٠٠٠٠ م في جولة، ويفتح لك الكندورة الذهبية اللي تبطّئ بابا ٤٠٪', perk_gold: 'بابا يلحقك أبطأ بـ ٤٠٪', perk_kit: 'بابا يلحقك أبطأ بـ ٢٠٪', r_kit_purple: 'طقم العين', r_kit_yellow: 'طقم الوصل', r_kit_red: 'طقم شباب الأهلي', r_kit_blue: 'طقم النصر', r_kit_white: 'طقم الشارقة', w_kits: 'الأطقم الرياضية', bg_zone1: 'وصلت داون تاون', bg_zone1_d: 'وصّل وسط مدينة دبي',
    bg_zone2: 'نزهة الممزر', bg_zone2_d: 'وصّل حديقة الممزر', bg_zone3: 'ريحة السوق', bg_zone3_d: 'وصّل سوق الشارقة القديم',
    bg_sweets100: 'حب الحلاوة', bg_sweets100_d: 'اجمع ١٠٠ حلاوة', bg_sweets1000: 'مخزن الحلاوة', bg_sweets1000_d: 'اجمع ١٠٠٠ حلاوة',
    bg_close10: 'على الحافة', bg_close10_d: '١٠ نجاة بأعجوبة في جولة', bg_sandal10: 'ضد النعال', bg_sandal10_d: 'انقز فوق ١٠ نعالات طايرة',
    bg_smash10: 'سكوتر التكسير', bg_smash10_d: 'كسّر ١٠ أشياء بالسكوتر', bg_powers: 'جامع القوى', bg_powers_d: 'خذ كل أنواع القوى الخمسة',
    bg_streak7: 'أسبوع كامل', bg_streak7_d: 'ادخل اللعبة ٧ أيام ورا بعض', bg_shopper: 'أول شروة', bg_shopper_d: 'اشتر أي شي من المحل', bg_revived: 'رجعة قوية', bg_revived_d: 'استخدم فرصة ثانية',
    ms_title: 'مهمات اليوم', ms_note: 'تتجدد المهمات كل يوم. هذي أكبر طريقة تجمع فيها دراهم.', ms_bonus: n => `خلّص المهمات الثلاث اليوم: +${nf(n)} د.إ زيادة`, claim: 'استلم', claimed: 'تم ✓',
    ms_runDist: g => `اركض ${g} م في جولة وحدة`, ms_daySweets: g => `اجمع ${g} حلاوة اليوم`, ms_dayClose: g => `${g} نجاة بأعجوبة اليوم`,
    ms_dayDodge: g => `انقز فوق ${g} نعالات اليوم`, ms_dayPower: g => `خذ ${g} قوى اليوم`, ms_dayRuns: g => `العب ${g} جولات اليوم`, ms_runZone: g => `وصّل ${STR.ar['zn' + g]} في جولة`,
    zn0: 'جميرا', zn1: 'وسط مدينة دبي', zn2: 'حديقة الممزر', zn3: 'سوق الشارقة القديم',
    lg_title: 'هدية الدخول اليومية', lg_day: n => `اليوم ${n}`, lg_claim: n => `استلم ${nf(n)} د.إ`, lg_done: 'استلمت هدية اليوم. ارجع باجر!', lg_streak: n => `${n} أيام ورا بعض`,
    o_earned: 'الدراهم', o_badges: 'أوسمة جديدة', o_revive: n => `فرصة ثانية (${n})`, o_reviveFree: 'فرصة ثانية مجانية', o_reviveBuy: n => `فرصة ثانية · ${nf(n)} د.إ`, o_none: 'ما في أوسمة جديدة هالمرة.',
    caughtT: 'بابا مسكك!', fellT: 'طحت في الحفرة!',
    f_shield: 'الدرع حماك!', f_revive: 'رجعنا!', f_badge: n => `وسام جديد: ${n}`,
    help_title: 'طريقة اللعب', ld_save: 'نجهّز ملفك…',
    s_shouts: ['تعال هنيه!', 'يا ولد!', 'وقّف يا {n}!', 'وين رايح؟!', 'والله لأعلّمك!', 'يا {n}!', 'ارجع البيت!'],
    s_taunts: ['ما تلحقني!', 'بابا تعبت؟', 'هههه!', 'مب أنا!', 'يلا بابا!'],
    s_throw: ['خذ هذي!', 'النعال!', 'شوف هذا!'], s_hit: ['قرّبت منك!', 'هههه!', 'شوي شوي!'], s_scared: ['آسف بابا!', 'لا لا لا!', 'ماما!'],
    s_come: 'تعال هنيه!', s_slip: 'آآآخ! كرات!', s_phone: 'هلا أم عبود…', s_yay: 'ييييه!', s_scoot: 'باي باي بابا!',
    s_got: 'مسكتك!', s_fell: 'طحت يا ولد!', s_sorry: 'آسف بابا!', phoneScreen: 'ماما',
    area: n => `المنطقة ${n}`,
    sign_baqala: 'بقالة', sign_cafe: 'كافتيريا', sign_karak: 'شاي كرك', sign_salon: 'صالون حلاقة', sign_laundry: 'مغسلة', sign_pharmacy: 'صيدلية', sign_resto: 'مطعم',
    truck_karak: 'كرك', truck_ice: 'آيس كريم', truck_burger: 'برجر', water: 'ماء',
    pickTitle: 'اختر اللغة', pickHint: 'تقدر تغيّرها بعدين من العلم فوق.',
    story: 'عبود سوّى حركة جديدة! وبابا وراه على طول، غترته معوجّة والنعال في يده. اركض على شاطئ جميرا، وفي وسط مدينة دبي، وجنب بحر الممزر، لين توصل سوق الشارقة القديم.',
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
    c_focus: n => `تركيز ${n}/3`, help_focus: 'التركيز: كل ٢٠ ثانية بدون ما تنصدم يرتفع تركيزك درجة (لين ٣)، وكل درجة تخلي بابا أبطأ ١٠٪. النجاة بأعجوبة تقرّبك للدرجة الجاية، والصدمة ترجّعه صفر.', f_focus: n => `تركيز ${n}! بابا أبطأ`, c_vimto: 'فيمتو', c_scooter: 'سكوتر', c_magnet: 'مغناطيس', c_slip: 'بابا يتزحلق', c_phone: 'على التلفون',
    f_smash: 'تكسير!', f_close: 'نجوت!', f_jar: n => `+${n} حلاوة!`, f_combo: n => `كومبو ×${n}`,
    f_vimto: 'قوة الفيمتو!', f_slip: 'بابا تزحلق!', f_phone: 'ماما تتصل!', f_magnet: 'مغناطيس الحلاوة!', f_scooter: 'سكوتر!',
    paused: 'إيقاف مؤقت', pausedHint: 'المس الشاشة أو اضغط P للمتابعة',
    loading: 'جاري التحميل…', ready: 'جاهز!',
    ld_fonts: 'نجهّز الخطوط…', ld_sound: 'نجهّز الأصوات…', ld_art: 'نرسم عبود وبابا…', ld_cache: 'نحفظ اللعبة للعب بدون نت…',
    tips: ['نصيحة: الكرات الزجاج تخلي بابا يتزحلق ٤ ثواني.', 'نصيحة: بعد ١ كم يبدأ بابا يرمي النعال. لما تطلع «!» فوقه، انقز!', 'نصيحة: كل ١٠ حلاوات تبعدك عن بابا شوي.', 'نصيحة: القفزة الثانية في الهوا تنقذك من الحفر الكبيرة.'],
    update: 'نسخة جديدة من اللعبة جاهزة', updateBtn: 'حدّث',
    langName: 'English', langAria: 'Switch to English',
    pause: 'إيقاف مؤقت', sound: 'الصوت والموسيقى',
  },
  en: {
    title: 'Run, Abood!',
    kicker: 'Baba is right behind you!',
    cur: 'AED', coins: n => `AED ${nf(n)}`,
    b_wardrobe: 'Wardrobe', b_shop: 'Shop', b_badges: 'Badges', b_missions: 'Missions', b_help: 'How to play', b_close: 'Close', b_menu: 'Menu',
    boostersTitle: 'Boosters for this run', noBoosters: 'Buy boosters in the shop to start stronger.',
    ch_abood: 'Abood',
    r_white: 'White', r_cream: 'Cream', r_grey: 'Grey', r_blue: 'Sky blue', r_brown: 'Winter brown', r_gold: 'Gold',
    h_shemagh: 'Red shemagh', h_ghutra: 'White ghutra', h_blackshemagh: 'Black shemagh', h_tagiyah: 'Tagiyah cap',
    w_title: 'Wardrobe', w_avatar: "Abood's look", av_classic: 'Classic', av_glasses: 'Glasses', av_shades: 'Sunglasses', w_robes: 'Kandura colour', w_heads: 'Headwear',
    buy: n => `Buy · AED ${nf(n)}`, wear: 'Wear', wearing: 'Wearing', choose: 'Choose', chosen: 'Chosen', badgeOnly: 'Unlocked by a badge', notEnough: 'Not enough dirhams', bought: 'Bought!', have: n => `You have ${n}`,
    shopTitle: 'Shop', shopNote: 'In-game dirhams only, for testing. No real payments.',
    bo_vimto: 'Starting Vimto', bo_vimto_d: 'Start the run 6 seconds faster', bo_magnet: 'Starting magnet', bo_magnet_d: 'Pulls in sweets for the first 10 seconds',
    bo_headstart: 'Head start', bo_headstart_d: 'Start on a scooter, further ahead of Baba', bo_shield: 'Shield', bo_shield_d: 'Blocks the first hit',
    bo_revive: 'Second chance', bo_revive_d: 'The first one each run is free. These are for the ones after',
    bg_title: 'Badges', bg_count: (a, b) => `${a} of ${b}`, bg_locked: 'Locked', bg_reward: n => `+AED ${nf(n)}`,
    bg_first: 'First run', bg_first_d: 'Play one run', bg_dist500: '500 metres', bg_dist500_d: 'Run 500 m in one run', bg_dist1000: '1000 metres', bg_dist1000_d: 'Run 1000 m in one run',
    bg_dist2000: '2000 metres', bg_dist2000_d: 'Run 2000 m in one run', bg_dist5000: '5000 metres', bg_dist5000_d: 'Run 5000 m in one run', bg_dist10000: 'Emirates runner', bg_dist10000_d: 'Run 10,000 m in one run. Unlocks the gold kandura, which slows Baba by 40%', perk_gold: 'Baba catches up 40% slower', perk_kit: 'Baba catches up 20% slower', r_kit_purple: 'Al Ain kit', r_kit_yellow: 'Al Wasl kit', r_kit_red: 'Shabab Al Ahli kit', r_kit_blue: 'Al Nasr kit', r_kit_white: 'Sharjah kit', w_kits: 'Football kits', bg_zone1: 'Downtown arrival', bg_zone1_d: 'Reach Downtown Dubai',
    bg_zone2: 'Al Mamzar picnic', bg_zone2_d: 'Reach Al Mamzar Park', bg_zone3: 'Souq explorer', bg_zone3_d: 'Reach Sharjah Old Souq',
    bg_sweets100: 'Sweet tooth', bg_sweets100_d: 'Collect 100 sweets', bg_sweets1000: 'Sweet shop', bg_sweets1000_d: 'Collect 1000 sweets',
    bg_close10: 'Close shave', bg_close10_d: '10 close calls in one run', bg_sandal10: 'Sandal dodger', bg_sandal10_d: 'Jump over 10 flying sandals',
    bg_smash10: 'Scooter smash', bg_smash10_d: 'Smash 10 things on the scooter', bg_powers: 'Power collector', bg_powers_d: 'Pick up all five kinds of power-up',
    bg_streak7: 'Full week', bg_streak7_d: 'Log in 7 days in a row', bg_shopper: 'First buy', bg_shopper_d: 'Buy anything in the shop', bg_revived: 'Comeback', bg_revived_d: 'Use a second chance',
    ms_title: "Today's missions", ms_note: 'New missions every day. They are the main way to earn dirhams.', ms_bonus: n => `Finish all three today: +AED ${nf(n)} extra`, claim: 'Claim', claimed: 'Done ✓',
    ms_runDist: g => `Run ${g} m in one run`, ms_daySweets: g => `Collect ${g} sweets today`, ms_dayClose: g => `Make ${g} close calls today`,
    ms_dayDodge: g => `Jump over ${g} flying sandals today`, ms_dayPower: g => `Pick up ${g} power-ups today`, ms_dayRuns: g => `Play ${g} runs today`, ms_runZone: g => `Reach ${STR.en['zn' + g]} in one run`,
    zn0: 'Jumeirah', zn1: 'Downtown Dubai', zn2: 'Al Mamzar Park', zn3: 'Sharjah Old Souq',
    lg_title: 'Daily login gift', lg_day: n => `Day ${n}`, lg_claim: n => `Claim AED ${nf(n)}`, lg_done: "You've claimed today's gift. Come back tomorrow!", lg_streak: n => `${n}-day streak`,
    o_earned: 'Dirhams', o_badges: 'New badges', o_revive: n => `Second chance (${n})`, o_reviveFree: 'Free second chance', o_reviveBuy: n => `Second chance · AED ${nf(n)}`, o_none: 'No new badges this time.',
    caughtT: 'Baba caught you!', fellT: 'Into the hole!',
    f_shield: 'Shield saved you!', f_revive: 'Back in the race!', f_badge: n => `New badge: ${n}`,
    help_title: 'How to play', ld_save: 'Loading your progress…',
    s_shouts: ['Come here!', 'Hey, you!', 'Stop, {n}!', 'Where are you going?!', 'Wait till I catch you!', '{n}!!', 'Home, now!'],
    s_taunts: ["Can't catch me!", 'Tired, Baba?', 'Hehehe!', "Wasn't me!", 'Come on, Baba!'],
    s_throw: ['Take this!', 'The sandal!', 'Watch this!'], s_hit: ["I'm gaining!", 'Ha ha!', 'Not so fast!'], s_scared: ['Sorry, Baba!', 'No no no!', 'Mama!'],
    s_come: 'Come here!', s_slip: 'Whoa! Marbles!', s_phone: 'Hello, Umm Abood…', s_yay: 'Yaaay!', s_scoot: 'Bye bye, Baba!',
    s_got: 'Got you!', s_fell: 'You fell, boy!', s_sorry: 'Sorry, Baba!', phoneScreen: 'Mama',
    area: n => `Area ${n}`,
    sign_baqala: 'Grocery', sign_cafe: 'Cafeteria', sign_karak: 'Karak Tea', sign_salon: 'Barber', sign_laundry: 'Laundry', sign_pharmacy: 'Pharmacy', sign_resto: 'Restaurant',
    truck_karak: 'Karak', truck_ice: 'Ice Cream', truck_burger: 'Burgers', water: 'WATER',
    pickTitle: 'Choose your language', pickHint: 'You can change it later with the flags at the top.',
    story: 'Abood got up to mischief again. Baba is right behind him, ghutra knocked crooked and a sandal in his hand. Run along the beach at Jumeirah, through Downtown Dubai, past the boats at Al Mamzar and into Sharjah Old Souq.',
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
    c_focus: n => `Focus ${n}/3`, help_focus: 'Focus: every 20 seconds without getting hit raises your focus by one level (up to 3), and each level makes Baba 10% slower. Close calls bring the next level closer; getting hit resets it to 0.', f_focus: n => `Focus ${n}! Baba slows down`, c_vimto: 'Vimto', c_scooter: 'Scooter', c_magnet: 'Magnet', c_slip: 'Baba slipping', c_phone: 'On the phone',
    f_smash: 'Smash!', f_close: 'Close one!', f_jar: n => `+${n} sweets!`, f_combo: n => `Combo x${n}`,
    f_vimto: 'Vimto power!', f_slip: 'Baba slips!', f_phone: 'Mama is calling!', f_magnet: 'Sweet magnet!', f_scooter: 'Scooter!',
    paused: 'Paused', pausedHint: 'Tap or press P to keep running',
    loading: 'Loading…', ready: 'Ready!',
    ld_fonts: 'Loading fonts…', ld_sound: 'Building sounds…', ld_art: 'Drawing Abood and Baba…', ld_cache: 'Saving the game for offline play…',
    tips: ['Tip: marbles make Baba slip for 4 seconds.', 'Tip: after 1 km Baba starts throwing his sandal. When “!” appears over him, jump!', 'Tip: every 10 sweets push Baba back a little.', 'Tip: the double jump saves you over wide holes.'],
    update: 'A new version of the game is ready', updateBtn: 'Update',
    langName: 'العربية', langAria: 'التبديل إلى العربية',
    pause: 'Pause', sound: 'Sound and music',
  },
};

// Flags shown on the switch: the flag of the language you would switch TO.
export const FLAG = {
  en: '<svg viewBox="0 0 60 30" aria-hidden="true"><clipPath id="ukS"><path d="M0,0v30h60V0z"/></clipPath><clipPath id="ukT"><path d="M30,15h30v15zv15H0zH0V0zV0h30z"/></clipPath><g clip-path="url(#ukS)"><path d="M0,0v30h60V0z" fill="#012169"/><path d="M0,0L60,30M60,0L0,30" stroke="#fff" stroke-width="6"/><path d="M0,0L60,30M60,0L0,30" clip-path="url(#ukT)" stroke="#C8102E" stroke-width="4"/><path d="M30,0v30M0,15h60" stroke="#fff" stroke-width="10"/><path d="M30,0v30M0,15h60" stroke="#C8102E" stroke-width="6"/></g></svg>',
  ar: '<svg viewBox="0 0 12 6" aria-hidden="true"><rect width="12" height="2" fill="#00732f"/><rect y="2" width="12" height="2" fill="#fff"/><rect y="4" width="12" height="2" fill="#000"/><rect width="3" height="6" fill="#ff0000"/></svg>',
};

let lang = 'ar';
try { const s = localStorage.getItem('abood-lang'); if (s === 'en' || s === 'ar') lang = s; } catch (e) {}
const listeners = [];

export const getLang = () => lang;
export function TG(key, girl, ...args) { return T(girl && (STR[lang][key + 'G'] !== undefined) ? key + 'G' : key, ...args); }
export function T(key, ...args) {
  const v = STR[lang][key] ?? STR.en[key] ?? key;
  return typeof v === 'function' ? v(...args) : v;
}
export function onLang(fn) { listeners.push(fn); }
export const hasStoredLang = () => { try { const v = localStorage.getItem('abood-lang'); return v === 'ar' || v === 'en'; } catch (e) { return false; } };
export function applyLang() {
  const root = document.documentElement;
  root.lang = lang; root.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.title = T('title');
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = T(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', T(el.dataset.i18nAria)); });
  document.querySelectorAll('.lang').forEach(g => {
    g.innerHTML = ['ar', 'en'].map(l => `<button type="button" data-lang="${l}" class="${l === lang ? 'on' : ''}" aria-pressed="${l === lang}" aria-label="${l === 'ar' ? 'العربية' : 'English'}">${FLAG[l]}</button>`).join('');
  });
  listeners.forEach(fn => fn(lang));
}
export function setLang(l) {
  lang = l; try { localStorage.setItem('abood-lang', l); } catch (e) {}
  applyLang();
}
export function toggleLang() { setLang(lang === 'ar' ? 'en' : 'ar'); }
