/* Sāqiya — site de présentation en français / arabe (bouton العربية dans l'en-tête).
   Les textes sont traduits sur place ; le choix est mémorisé et partagé avec le tableau de bord. */
(function () {
  const AR = {
    "Sāqiya — l'irrigation qui écoute le sol": "الساقية — السقي الذي يصغي إلى التربة",
    "Sāqiya, accueil": "الساقية، الصفحة الرئيسية",
    "Vidéo": "الفيديو", "Le constat": "الواقع", "Fonctionnement": "طريقة العمل", "Fonctions": "الوظائف",
    "Le boîtier": "الجهاز", "Questions": "أسئلة", "Ouvrir le tableau de bord": "فتح لوحة التحكم", "Menu": "القائمة",
    "Startup algérienne 🇩🇿 · Irrigation intelligente IoT et IA": "شركة ناشئة جزائرية 🇩🇿 · سقي ذكي بإنترنت الأشياء والذكاء الاصطناعي",
    "Arroser quand": "اسقِ عندما", "le sol": "تطلب", "le demande": "التربة", "pas à heure fixe.": "لا في ساعة ثابتة.", ",": "،",
    "Un boîtier planté dans la parcelle mesure l'humidité, le sol et l'air. Le système décide seul d'ouvrir l'eau, attend la pluie quand elle est annoncée, repère les conditions des maladies avant les premières taches, et répond aux questions de l'agriculteur en arabe, en darija ou en français.":
      "جهاز مغروس في الحقل يقيس الرطوبة والتربة والهواء. يقرر النظام وحده فتح الماء، وينتظر المطر عندما يكون متوقعا، ويرصد ظروف الأمراض قبل ظهور أول البقع، ويجيب على أسئلة الفلاح بالعربية أو الدارجة أو الفرنسية.",
    "Voir la parcelle en direct": "شاهد الحقل مباشرة", "Tableau de bord ·": "لوحة التحكم ·",
    "Comment ça marche": "كيف يعمل", "Vidéo d'une minute": "فيديو في دقيقة",
    "En ce moment, parcelle de démonstration": "الآن، حقل تجريبي", "Sol": "التربة", "Air": "الهواء", "Pompe": "المضخة",
    "Jeunes plants alimentés par une ligne de goutte-à-goutte": "نباتات صغيرة يغذيها خط سقي بالتنقيط",
    "Goutte-à-goutte : l'eau va au pied de la plante, pas dans l'allée.": "التنقيط: يذهب الماء إلى جذر النبتة، لا إلى الممر.",
    "Sāqiya en une minute": "الساقية في دقيقة", "Regardez comment l'eau arrive au bon moment.": "شاهد كيف يصل الماء في الوقت المناسب.",
    "Lire la vidéo": "تشغيل الفيديو", "Lecture / pause": "تشغيل / إيقاف", "Langue des sous-titres": "لغة الترجمة", "Plein écran": "ملء الشاشة",
    "Son": "الصوت", "Activer la musique": "تشغيل الموسيقى",
    "Asperseurs arrosant un champ en plein jour": "مرشات تسقي حقلا في وضح النهار",
    "L'eau est la première ressource de la ferme, et la plus mal mesurée.": "الماء أول مورد في المزرعة، وأقلها قياسا.",
    "des prélèvements d'eau douce dans le monde vont à l'agriculture.": "من المياه العذبة المستعملة في العالم تذهب إلى الفلاحة.",
    "FAO, AQUASTAT": "الفاو، أكواستات",
    "Dans la plupart des exploitations, on arrose encore à l'heure fixe ou « au jugé » : trop après une nuit de pluie, pas assez pendant un coup de chaleur. L'excès d'eau abîme les racines et favorise les champignons ; le manque fait chuter le rendement. Personne n'a le temps de vérifier le sol trois fois par jour. Un capteur, si.":
      "في أغلب المزارع ما زلنا نسقي في ساعة ثابتة أو «بالتقدير»: كثيرا بعد ليلة ممطرة، وقليلا في موجة حر. الماء الزائد يضر بالجذور ويساعد الفطريات، ونقصه يخفض المردود. لا أحد لديه الوقت لفحص التربة ثلاث مرات في اليوم. المستشعر يفعل ذلك.",
    "Mesurer, décider, agir.": "قِس، قرّر، نفّذ.",
    "Mains plantant un jeune plant dans une terre sombre": "يدان تغرسان نبتة صغيرة في تربة داكنة",
    "Mesurer": "القياس",
    "Toutes les 30 secondes, le boîtier relève l'humidité et la température du sol, le pH, la salinité, l'azote, le phosphore et le potassium, la température et l'humidité de l'air, et la pluie.":
      "كل 30 ثانية، يقيس الجهاز رطوبة التربة وحرارتها، والـ pH، والملوحة، والآزوت والفوسفور والبوتاسيوم، وحرارة الهواء ورطوبته، والمطر.",
    "Rangée de jeunes plants dans un sol travaillé": "صف من النباتات الصغيرة في تربة محروثة",
    "Décider": "القرار",
    "Le serveur compare ces mesures aux besoins de la culture et au type de sol, consulte les prévisions de pluie des 12 prochaines heures, puis calcule s'il faut arroser, et combien de temps.":
      "يقارن الخادم هذه القياسات باحتياجات الزراعة ونوع التربة، ويطّلع على توقعات المطر للساعات الـ 12 القادمة، ثم يحسب هل يجب السقي وكم من الوقت.",
    "Tuyau d'irrigation posé entre les plants": "أنبوب سقي بين النباتات",
    "Agir": "التنفيذ",
    "Le relais ouvre la pompe pour la durée calculée, puis la referme dès que l'humidité cible est atteinte. Après chaque arrosage, le système apprend la réponse réelle de la parcelle et ajuste la suivante.":
      "يفتح المرحّل المضخة للمدة المحسوبة، ثم يغلقها بمجرد بلوغ الرطوبة المطلوبة. بعد كل سقي، يتعلم النظام استجابة الحقل الحقيقية ويعدّل السقي التالي.",
    "Rangs de tomates dans une serre vitrée": "صفوف من الطماطم في بيت زجاجي",
    "01 · Irrigation automatique": "01 · السقي التلقائي",
    "La pompe s'ouvre quand le sol passe sous le seuil, et seulement s'il ne va pas pleuvoir.": "تشتغل المضخة عندما تنزل التربة تحت العتبة، وفقط إذا لم يكن المطر متوقعا.",
    "Le seuil dépend du sol (sableux, limoneux, argileux) et de la culture : un olivier supporte un sol plus sec qu'une fraise. Si plus de 3 mm de pluie sont annoncés, l'arrosage attend.":
      "تختلف العتبة حسب التربة (رملية، طميية، طينية) وحسب الزراعة: الزيتون يتحمل تربة أجف من الفراولة. إذا كان متوقعا أكثر من 3 مم من المطر، ينتظر السقي.",
    "Exemple de règle de décision": "مثال على قاعدة القرار", "humidité": "الرطوبة", "< seuil": "< العتبة",
    "pluie prévue": "المطر المتوقع", "0 mm": "0 مم", "→ 7 min de pompe": "← 7 دقائق من الضخ",
    "Gros plan d'une feuille tachée de brun": "ورقة عليها بقع بنية عن قرب",
    "02 · Prévention des maladies": "02 · الوقاية من الأمراض",
    "Les champignons ont besoin de conditions précises. Le système les voit arriver.": "الفطريات تحتاج ظروفا محددة. النظام يراها قادمة.",
    "Mildiou, oïdium, pourriture grise, rouille, pourriture des racines : chacune apparaît avec une combinaison d'humidité, de température et d'heures de feuillage mouillé. Un modèle statistique estime le risque chaque minute et prévient l'agriculteur avant les premiers symptômes.":
      "البياض الزغبي، البياض الدقيقي، العفن الرمادي، الصدأ، تعفن الجذور: كل مرض يظهر مع مزيج من الرطوبة والحرارة وساعات ابتلال الأوراق. نموذج إحصائي يقدّر الخطر كل دقيقة وينبه الفلاح قبل ظهور الأعراض.",
    "Mildiou": "البياض الزغبي", "Oïdium": "البياض الدقيقي", "Botrytis": "العفن الرمادي",
    "Exemple d'affichage. Les valeurs réelles sont dans le tableau de bord.": "مثال للعرض. القيم الحقيقية في لوحة التحكم.",
    "Agricultrice sur un tracteur au lever du soleil": "فلاحة على جرار عند شروق الشمس",
    "03 · Le conseiller": "03 · المستشار",
    "Une question, dans sa langue. Une réponse qui connaît la parcelle.": "سؤال بلغتك. وجواب يعرف حقلك.",
    "Le conseiller lit les mesures en direct et une base de connaissances sur les cultures, les maladies et les engrais. Il répond simplement, avec des chiffres du champ.":
      "يقرأ المستشار القياسات مباشرة وقاعدة معارف حول الزراعات والأمراض والأسمدة. ويجيب ببساطة، بأرقام من الحقل.",
    "Pas tout de suite : le sol est à 35 %, au-dessus du seuil de 32 %, et aucune pluie n'est annoncée. Le prochain arrosage est estimé dans environ 3 heures.":
      "ليس الآن: التربة عند 35 %، فوق عتبة 32 %، ولا يوجد مطر متوقع. السقي القادم متوقع بعد حوالي 3 ساعات.",
    "Cultures prises en charge": "الزراعات المدعومة",
    "Huit cultures de nos régions, de la Mitidja aux Hauts Plateaux, chacune avec ses seuils.": "ثماني زراعات من مناطقنا، من متيجة إلى الهضاب العليا، لكل واحدة عتباتها.",
    "Tomates mûres sur pied": "طماطم ناضجة على النبتة", "Tomate": "الطماطم", "Oliveraie avec un mur de pierre": "بستان زيتون بجدار حجري",
    "Olivier": "الزيتون", "Champ de blé au coucher du soleil": "حقل قمح عند الغروب", "Blé": "القمح",
    "Planche de légumes irriguée": "لوح خضر مسقي", "Maraîchage": "الخضروات",
    "Tomate · Pomme de terre · Blé · Olivier · Agrumes · Poivron · Fraise · Vigne": "الطماطم · البطاطا · القمح · الزيتون · الحمضيات · الفلفل · الفراولة · العنب",
    "Des composants courants, un code ouvert.": "مكونات متوفرة، وبرنامج مفتوح.",
    "Le boîtier repose sur une carte ESP32 avec WiFi. Les capteurs se trouvent chez n'importe quel revendeur d'électronique, et le programme est fourni. S'il perd la connexion, la pompe se coupe d'elle-même à la fin de la durée prévue : jamais d'arrosage sans limite.":
      "يعتمد الجهاز على بطاقة ESP32 مع واي فاي. المستشعرات متوفرة عند أي بائع إلكترونيات، والبرنامج مرفق. إذا انقطع الاتصال، تتوقف المضخة وحدها عند نهاية المدة المحددة: لا سقي بلا حدود أبدا.",
    "Humidité du sol": "رطوبة التربة", "capteur capacitif v1.2": "مستشعر سعوي v1.2", "Température du sol": "حرارة التربة",
    "sonde étanche DS18B20": "مسبار مقاوم للماء DS18B20", "DHT22, température et humidité": "DHT22، الحرارة والرطوبة",
    "pH et salinité": "الـ pH والملوحة", "sondes analogiques pH et EC": "مسابر تماثلية pH و EC", "capteur RS485 Modbus": "مستشعر RS485 Modbus",
    "Pluie": "المطر", "module de détection YL-83": "وحدة كشف YL-83", "relais 5 V, pompe ou électrovanne": "مرحّل 5 فولت، مضخة أو صمام كهربائي",
    "Cartes électroniques posées sur un fond bleu": "بطاقات إلكترونية على خلفية زرقاء",
    "Le tableau de bord": "لوحة التحكم", "Ce n'est pas une maquette. C'est la parcelle, maintenant.": "ليست نموذجا. إنه الحقل، الآن.",
    "Jauge d'humidité, scène animée, analyses sur 7 jours, photos, conseiller : tout est accessible depuis un ordinateur ou un téléphone.":
      "مقياس الرطوبة، مشهد متحرك، تحاليل على 7 أيام، صور، مستشار: كل شيء متاح من حاسوب أو هاتف.",
    "Tableau de bord en direct": "لوحة التحكم مباشرة", "Ouvrir en plein écran": "فتح بملء الشاشة",
    "Ce qu'on nous demande le plus souvent.": "الأسئلة الأكثر تكرارا.",
    "Qui est derrière Sāqiya ?": "من وراء الساقية؟",
    "Une startup algérienne de l'agriculture intelligente. Le boîtier, le serveur et le tableau de bord sont conçus et développés en Algérie, pour les cultures, le climat et les agriculteurs d'ici, en arabe, en darija et en français.":
      "شركة ناشئة جزائرية في الفلاحة الذكية. الجهاز والخادم ولوحة التحكم صُممت وطُورت في الجزائر، لزراعات ومناخ وفلاحي هذا البلد، بالعربية والدارجة والفرنسية.",
    "Faut-il une connexion Internet ?": "هل يلزم اتصال بالإنترنت؟",
    "Le boîtier a besoin du WiFi pour joindre le serveur, qui peut tourner sur un simple ordinateur de la ferme. Internet sert seulement aux prévisions météo et au conseiller complet. Sans Internet, l'irrigation continue avec le capteur de pluie, et le conseiller donne des réponses de base.":
      "يحتاج الجهاز إلى الواي فاي للوصول إلى الخادم، الذي يمكن أن يعمل على حاسوب بسيط في المزرعة. الإنترنت يُستعمل فقط لتوقعات الطقس وللمستشار الكامل. بدون إنترنت، يستمر السقي بمستشعر المطر، ويقدم المستشار إجابات أساسية.",
    "Et si le serveur s'arrête pendant un arrosage ?": "وإذا توقف الخادم أثناء السقي؟",
    "Le boîtier connaît la durée prévue et coupe la pompe lui-même à l'échéance. Au redémarrage, le serveur clôt proprement l'arrosage interrompu dans le journal.":
      "يعرف الجهاز المدة المحددة ويوقف المضخة بنفسه عند انتهائها. عند إعادة التشغيل، يغلق الخادم السقي المنقطع في السجل بشكل سليم.",
    "Peut-on arroser à la main ?": "هل يمكن السقي يدويا؟",
    "Oui. Le mode manuel suspend les décisions automatiques ; un bouton lance un arrosage de 1 à 15 minutes.": "نعم. الوضع اليدوي يوقف القرارات التلقائية، وزر واحد يشغّل سقيا من 1 إلى 15 دقيقة.",
    "Comment la prédiction des maladies est-elle construite ?": "كيف بُني توقع الأمراض؟",
    "Par un classifieur bayésien entraîné sur les conditions connues de chaque maladie. Le jeu de données fourni est synthétique : il est conçu pour être remplacé par les observations réelles de l'exploitation.":
      "بمصنِّف بايزي مدرَّب على الظروف المعروفة لكل مرض. مجموعة البيانات المرفقة اصطناعية، وهي مصممة لتُستبدل بملاحظات المزرعة الحقيقية.",
    "Dans quelles langues fonctionne le conseiller ?": "بأي لغات يعمل المستشار؟",
    "Arabe standard, darija et français. Il répond dans la langue de la question.": "العربية الفصحى والدارجة والفرنسية. يجيب بلغة السؤال.",
    "La parcelle de démonstration tourne en ce moment.": "الحقل التجريبي يعمل الآن.",
    // pied de page
    "L'irrigation qui écoute le sol.": "السقي الذي يصغي إلى التربة.",
    "Startup algérienne de l'irrigation intelligente : capteurs, arrosage automatique, prévision des maladies et conseiller agricole en arabe, darija et français.":
      "شركة ناشئة جزائرية للسقي الذكي: مستشعرات، سقي تلقائي، توقع الأمراض ومستشار فلاحي بالعربية والدارجة والفرنسية.",
    "Le produit": "المنتج", "Ressources": "موارد", "L'équipe": "الفريق", "Rester en contact": "ابقَ على تواصل",
    "Arrosage automatique": "السقي التلقائي", "Détection des maladies": "كشف الأمراض", "Conseiller agricole": "المستشار الفلاحي",
    "Le boîtier ESP32": "جهاز ESP32", "La vidéo": "الفيديو", "Questions fréquentes": "الأسئلة الشائعة", "Code source (GitHub)": "الشيفرة المصدرية (GitHub)",
    "Équipe de travail": "فريق العمل", "Équipe de supervision": "فريق الإشراف",
    "Suivez le projet sur GitHub ou ouvrez le tableau de bord pour voir la parcelle.": "تابع المشروع على GitHub أو افتح لوحة التحكم لرؤية الحقل.",
    "Conçu et développé en Algérie 🇩🇿": "صُمم وطُور في الجزائر 🇩🇿", "Haut de page": "أعلى الصفحة",
    "Photographies : Unsplash (licence Unsplash) · Météo : Open-Meteo": "الصور: Unsplash (رخصة Unsplash) · الطقس: Open-Meteo",
    "Langue": "اللغة",
    "Aucune mesure reçue pour l'instant.": "لم يصل أي قياس بعد.", "Arrosage en cours.": "السقي جارٍ.",
  };
  const FR_KEY = "__fr";
  let lang = "fr";
  try { lang = localStorage.getItem("saqiya-lang") === "ar" ? "ar" : "fr"; } catch { /* préférence indisponible */ }

  // textes déjà bilingues ou à ne pas traduire (la balise <html lang="ar"> elle-même n'en fait pas partie)
  const skip = (el) => el.closest("[data-fr], [lang='ar']:not(html), [data-site-lang], script, style, svg, [data-noi18n]");
  function walk(root) {
    const out = [];
    const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = it.nextNode())) if (n.nodeValue.trim() && !skip(n.parentElement)) out.push(n);
    return out;
  }
  function apply() {
    const ar = lang === "ar";
    document.documentElement.lang = lang;
    document.documentElement.dir = ar ? "rtl" : "ltr";
    for (const n of walk(document.body)) {
      if (n[FR_KEY] === undefined) n[FR_KEY] = n.nodeValue;
      const fr = n[FR_KEY], key = fr.trim().replace(/\s+/g, " ");
      if (ar && AR[key]) n.nodeValue = fr.replace(fr.trim(), AR[key]);
      else n.nodeValue = fr;
    }
    document.querySelectorAll("[alt], [aria-label], [title], [placeholder]").forEach((el) => {
      if (skip(el) && !el.matches("button, a, img")) return;
      for (const a of ["alt", "aria-label", "title", "placeholder"]) {
        if (!el.hasAttribute(a)) continue;
        const k = "data-fr-" + a;
        if (!el.hasAttribute(k)) el.setAttribute(k, el.getAttribute(a));
        const fr = el.getAttribute(k);
        el.setAttribute(a, ar && AR[fr] ? AR[fr] : fr);
      }
    });
    const title = "Sāqiya — l'irrigation qui écoute le sol";
    document.title = ar ? AR[title] : title;
    document.querySelectorAll("[data-site-lang]").forEach((b) => {
      b.textContent = ar ? "Français" : "العربية";
      b.lang = ar ? "fr" : "ar";
      b.setAttribute("aria-label", ar ? "Passer en français" : "التبديل إلى العربية");
    });
    window.dispatchEvent(new CustomEvent("saqiya-lang", { detail: lang }));   // sous-titres de la vidéo
  }
  document.addEventListener("click", (e) => {
    if (!e.target.closest("[data-site-lang]")) return;
    lang = lang === "ar" ? "fr" : "ar";
    try { localStorage.setItem("saqiya-lang", lang); } catch { /* idem */ }
    apply();
  });
  window.siteLang = () => lang;
  apply();
})();
