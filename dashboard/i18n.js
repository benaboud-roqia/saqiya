/* Sāqiya — traduction de l'interface en arabe (droite à gauche).
   Le tableau de bord est écrit en français ; en mode arabe, chaque texte affiché (fixe ou produit
   par le serveur) passe par ce traducteur : dictionnaire exact, modèles de phrases, puis
   textes agronomiques de la base de connaissances (/api/i18n/ar). */
(function () {
  let lang = "fr";
  try { lang = localStorage.getItem("saqiya-lang") === "ar" ? "ar" : "fr"; } catch { /* préférence indisponible */ }
  window.LANG = lang;
  // arabe (Algérie) : chiffres latins, horloge sur 24 h
  window.LOC = () => (window.LANG === "ar" ? "ar-DZ-u-hc-h23" : "fr-FR");

  /* ---------------- dictionnaire exact ---------------- */
  const D = {
    // navigation et en-tête
    "Rechercher": "بحث", "Parcelle": "الحقل", "Analyses": "التحاليل", "Photos": "الصور", "Conseiller": "المستشار",
    "Journal": "السجل", "Boîtier": "الجهاز", "Réglages": "الإعدادات", "Thème": "المظهر", "Capteur": "المستشعر",
    "Automatique": "تلقائي", "Manuel": "يدوي", "Clair": "فاتح", "Nuit": "ليلي", "Oasis": "واحة", "Désert": "صحراء",
    "Capteur connecté": "المستشعر متصل", "Capteur hors ligne": "المستشعر غير متصل", "Aucun relevé": "لا توجد قياسات",
    "Serveur injoignable": "الخادم لا يستجيب", "Nouvelle tentative…": "إعادة المحاولة…",
    "Retour au site de présentation": "العودة إلى موقع التقديم", "Mode d'irrigation": "طريقة السقي", "Langue": "اللغة",
    "Prévisions indisponibles": "توقعات الطقس غير متوفرة", "Parcelle de démonstration": "حقل تجريبي",
    // bannière
    "Sol": "التربة", "Air": "الهواء", "Pompe": "المضخة", "Pluie 12 h": "مطر 12 س", "en marche": "تعمل", "arrêtée": "متوقفة",
    "Sol sableux": "تربة رملية", "Sol limoneux": "تربة طميية", "Sol limono-argileux": "تربة طينية طميية", "Sol argileux": "تربة طينية",
    "Tomate": "طماطم", "Pomme de terre": "بطاطا", "Blé": "قمح", "Olivier": "زيتون", "Agrumes": "حمضيات",
    "Poivron / Piment": "فلفل", "Fraise": "فراولة", "Vigne": "كروم",
    // scène
    "Vue animée de la parcelle": "عرض متحرك للحقل", "Irrigation en cours": "السقي جارٍ", "Sol sec": "التربة جافة",
    "Pompe au repos": "المضخة متوقفة", "Il pleut": "إنها تمطر", "Météo indisponible": "الطقس غير متوفر",
    // jauge et irrigation
    "Humidité du sol": "رطوبة التربة", "Jauge d'humidité du sol": "مقياس رطوبة التربة", "Sec — arrosage": "جاف — سقي",
    "Zone idéale": "المنطقة المثالية", "seuil": "العتبة", "cible": "الهدف",
    "Arroser sous": "اسقِ تحت", "Objectif": "الهدف", "Sec": "جاف", "Mouillé": "مبلل",
    "Arrosage en cours : l'eau remonte.": "السقي جارٍ: الماء يرتفع.", "Le sol a trop d'eau : aucun arrosage.": "في التربة ماء زائد: لا سقي.",
    "Rien à faire : le sol a assez d'eau.": "لا شيء للقيام به: في التربة ماء كافٍ.", "Excès": "زيادة", "En attente du capteur": "في انتظار المستشعر",
    "Sol trop humide": "التربة رطبة جدا", "Bonne humidité": "رطوبة جيدة", "Irrigation": "السقي",
    "Pompe arrêtée": "المضخة متوقفة", "Pompe en marche": "المضخة تعمل", "En attente des premières mesures.": "في انتظار القياسات الأولى.",
    "Prochain arrosage": "السقي القادم", "Eau sur 24 h": "الماء خلال 24 س", "Débit appris": "التدفق المتعلَّم",
    "Durée de l'arrosage manuel": "مدة السقي اليدوي", "Moins": "أقل", "Plus": "أكثر",
    "Arroser maintenant": "اسقِ الآن", "Arrêter la pompe": "أوقف المضخة", "maintenant": "الآن",
    "dès que possible": "في أقرب وقت", "pas prévu": "غير مبرمج", "> 2 jours": "أكثر من يومين",
    "Arrosage manuel en cours.": "سقي يدوي جارٍ.", "Mode manuel : la pompe ne démarre que sur votre ordre.": "الوضع اليدوي: المضخة لا تعمل إلا بأمر منك.",
    "En attente des premières mesures du capteur.": "في انتظار القياسات الأولى من المستشعر.",
    "Le sol est assez humide. Pas besoin d'arroser pour le moment.": "التربة رطبة بما يكفي. لا حاجة للسقي حاليا.",
    "Mode automatique activé": "تم تفعيل الوضع التلقائي", "Mode manuel : la pompe n'agit que sur votre ordre": "الوضع اليدوي: المضخة تعمل بأمرك فقط",
    "Mode manuel activé": "تم تفعيل الوضع اليدوي", "Pompe arrêtée.": "المضخة متوقفة.",
    // prévisions et relevés
    "Les 12 prochaines heures": "الساعات الـ12 القادمة", "Pas de pluie attendue": "لا يُتوقع مطر", "Maint.": "الآن",
    "Pas de connexion au service météo. L'arrosage s'appuie sur le capteur de pluie.": "لا اتصال بخدمة الطقس. يعتمد السقي على مستشعر المطر.",
    "Relevés": "القياسات", "Température du sol": "حرارة التربة", "pH du sol": "حموضة التربة (pH)", "Salinité": "الملوحة",
    "Température de l'air": "حرارة الهواء", "Humidité de l'air": "رطوبة الهواء", "Pluie": "المطر", "Oui": "نعم", "Non": "لا",
    "feuillage humide": "أوراق مبللة", "météo du lieu": "حسب الطقس المحلي",
    "Aucun boîtier connecté": "لا يوجد جهاز متصل", "Relier le boîtier": "ربط الجهاز",
    "Le tableau de bord n'affiche que les vraies mesures de votre parcelle. Branchez l'ESP32 au PC avec le câble USB (moniteur série Arduino fermé) ou reliez-le en WiFi : les chiffres apparaîtront ici tout seuls.":
      "لوحة التحكم تعرض فقط القياسات الحقيقية لحقلك. صِل ESP32 بالحاسوب بكابل USB (مع غلق الشاشة التسلسلية في Arduino) أو اربطه بالواي فاي: ستظهر الأرقام هنا تلقائيا.",
    "Capteur du sol": "مستشعر التربة", "courbe de chaque mesure · zone verte = bon niveau": "منحنى كل قياس · المنطقة الخضراء = مستوى جيد",
    "Humidité": "الرطوبة", "T° du sol": "حرارة التربة", "pH": "pH", "Salinité EC": "الملوحة EC", "Azote N": "الآزوت N",
    "Phosphore P": "الفوسفور P", "Potassium K": "البوتاسيوم K", "bon niveau": "مستوى جيد", "bas": "منخفض", "élevé": "مرتفع",
    "sec": "جاف", "très humide": "رطب جدا", "trop salé": "مالح جدا",
    "La courbe apparaîtra après quelques mesures du capteur.": "سيظهر المنحنى بعد بعض قياسات المستشعر.",
    // graphique
    "Évolution": "التطور", "6 h": "6 س", "24 h": "24 س", "3 j": "3 أيام", "Température": "الحرارة",
    "seuil d'arrosage": "عتبة السقي", "Les courbes apparaîtront après quelques relevés.": "ستظهر المنحنيات بعد بعض القياسات.",
    "Évolution des relevés": "تطور القياسات", "pompe en marche": "المضخة تعمل",
    // santé et sol
    "Santé des plantes": "صحة النباتات", "prévision des maladies": "التنبؤ بالأمراض", "Risques": "المخاطر",
    "Aucun risque notable": "لا توجد مخاطر تذكر", "Quand elle apparaît.": "متى يظهر.", "Prévenir.": "الوقاية.", "Traiter.": "العلاج.",
    "Mildiou": "البياض الزغبي", "Oïdium": "البياض الدقيقي", "Pourriture grise / Botrytis": "العفن الرمادي",
    "Pourriture grise": "العفن الرمادي", "Rouille": "الصدأ", "Pourriture des racines / Asphyxie": "تعفن الجذور", "Pourriture des racines": "تعفن الجذور",
    "faible": "منخفض", "moyen": "متوسط", "élevé": "مرتفع",
    "Fertilité du sol": "خصوبة التربة", "pH, salinité, azote, phosphore, potassium": "الحموضة، الملوحة، الآزوت، الفوسفور، البوتاسيوم",
    "Analyse du sol": "تحليل التربة", "Éléments nutritifs": "العناصر الغذائية", "mg/kg · zone verte = bon niveau": "ملغ/كغ · المنطقة الخضراء = مستوى جيد",
    "4 acide": "4 حمضي", "7 neutre": "7 متعادل", "9 alcalin": "9 قلوي",
    "pH, salinité et nutriments sont au bon niveau. Un engrais d'entretien suffit.": "الحموضة والملوحة والعناصر الغذائية في مستوى جيد. يكفي سماد صيانة.",
    "En attente des relevés.": "في انتظار القياسات.", "Pas encore de mesures.": "لا توجد قياسات بعد.",
    // alertes
    "Alertes": "التنبيهات", "tout est lu": "تمت قراءة الكل", "Lu": "مقروء", "Rien à signaler.": "لا شيء للإبلاغ عنه.",
    // analyses
    "La semaine de la parcelle": "أسبوع الحقل", "Analyses · 7 jours": "تحاليل · 7 أيام", "Eau, humidité, climat, maladies et nutriments sur 7 jours.": "الماء والرطوبة والمناخ والأمراض والعناصر الغذائية خلال 7 أيام.",
    "Eau utilisée · 7 j": "الماء المستعمل · 7 أيام", "Arrosages · 7 j": "عمليات السقي · 7 أيام", "Humidité moyenne du sol": "متوسط رطوبة التربة",
    "Risque principal": "الخطر الرئيسي", "Eau d'irrigation par jour": "ماء السقي في اليوم", "litres estimés": "لترات تقديرية",
    "Humidité du sol par jour": "رطوبة التربة في اليوم", "minimum, maximum et moyenne": "الأدنى والأقصى والمتوسط", "zone idéale": "المنطقة المثالية",
    "Humidité de l'air, heure par heure": "رطوبة الهواء ساعة بساعة", "les cases foncées favorisent les maladies": "الخانات الداكنة تساعد على الأمراض",
    "sec": "جاف", "saturé": "مشبع", "Profil de risque": "خريطة المخاطر", "maladies de la culture": "أمراض الزراعة",
    "Températures": "درجات الحرارة", "écart jour / nuit": "الفرق بين النهار والليل", "moyenne journalière, mg/kg": "المتوسط اليومي، ملغ/كغ",
    "Azote (N)": "الآزوت (N)", "Phosphore (P)": "الفوسفور (P)", "Potassium (K)": "البوتاسيوم (K)",
    "Pas encore de relevés.": "لا توجد قياسات بعد.", "Pas encore assez de relevés.": "القياسات غير كافية بعد.",
    "Il faut au moins deux jours de relevés.": "يلزم يومان من القياسات على الأقل.",
    // photos
    "Photos de la parcelle": "صور الحقل",
    "Maladies": "الأمراض", "Détection des maladies des plantes": "كشف أمراض النباتات",
    "Startup algérienne de l'irrigation intelligente : le sol parle, Sāqiya l'écoute et arrose au bon moment.": "شركة ناشئة جزائرية للسقي الذكي: التربة تتكلم، والساقية تستمع وتسقي في الوقت المناسب.",
    "mesures du sol en direct": "قياسات للتربة مباشرة", "secondes entre deux relevés": "ثانية بين قياسين", "langues : arabe, darija, français": "لغات: العربية، الدارجة، الفرنسية",
    "Comment ça marche": "كيف يعمل", "Le capteur mesure": "المستشعر يقيس",
    "Humidité, température, pH, salinité, azote, phosphore et potassium du sol.": "رطوبة التربة وحرارتها وpH والملوحة والآزوت والفوسفور والبوتاسيوم.",
    "Le serveur analyse": "الخادم يحلل", "Il croise les mesures avec la météo réelle et la culture choisie.": "يقارن القياسات بالطقس الحقيقي وبالزراعة المختارة.",
    "Il décide": "يقرر", "Arroser maintenant, attendre la pluie, ou prévenir d'un risque de maladie.": "السقي الآن، أو انتظار المطر، أو التنبيه بخطر مرض.",
    "La parcelle est arrosée": "الحقل يُسقى", "La pompe s'ouvre juste le temps qu'il faut : moins d'eau, moins d'électricité.": "تعمل المضخة المدة اللازمة فقط: ماء أقل وكهرباء أقل.",
    "Équipe de travail": "فريق العمل", "Conception et réalisation du projet": "تصميم المشروع وإنجازه",
    "Équipe de supervision": "فريق الإشراف", "Encadrement scientifique": "التأطير العلمي",
    "Sur le terrain": "في الميدان", "Goutte-à-goutte au pied des plants": "التنقيط عند جذور النباتات", "Le boîtier ESP32": "جهاز ESP32",
    "Des récoltes protégées": "محاصيل محمية", "Chaque goutte compte": "كل قطرة لها قيمتها", "Fabriqué en Algérie": "صُنع في الجزائر",
    "Boîtier, serveur et tableau de bord conçus et développés en Algérie, pour nos cultures (Mitidja, Hauts Plateaux, oasis du Sud) et notre climat.":
      "الجهاز والخادم ولوحة التحكم صُممت وطُورت في الجزائر، لزراعاتنا (متيجة، الهضاب العليا، واحات الجنوب) ولمناخنا.",
    "Connexion avec Gmail (Google Cloud Console)": "الدخول عبر Gmail (Google Cloud Console)",
    "Photographiez une feuille ou un fruit qui vous inquiète. Le système reconnaît la plante, les symptômes et la maladie probable, puis vous dit quoi faire.":
      "صوّر ورقة أو ثمرة تقلقك. يتعرف النظام على النبات والأعراض والمرض المحتمل، ثم يخبرك بما يجب فعله.",
    "De près": "عن قرب", "une seule feuille, bien nette": "ورقة واحدة واضحة", "À la lumière du jour": "في ضوء النهار",
    "sans flash, sans contre-jour": "بدون فلاش وبدون ضوء خلفي", "Face malade visible": "الجهة المريضة ظاهرة",
    "taches, jaunissement, feutrage": "بقع، اصفرار، زغب أبيض", "Feuille": "ورقة", "Fruit": "ثمرة", "Plante entière": "النبتة كاملة",
    "Photographier une feuille": "صوّر ورقة", "Diagnostics": "التشخيصات", "Historique des diagnostics": "سجل التشخيصات", "Historique": "السجل", "Nouvelle": "جديدة", "Historique des conversations": "سجل المحادثات", "Aucune conversation pour l'instant.": "لا توجد محادثات بعد.", "Aujourd'hui": "اليوم", "Hier": "أمس", "Tous": "الكل", "Malades": "مريضة",
    "À surveiller": "للمراقبة", "Saines": "سليمة", "En cours": "جارٍ", "Maladies surveillées pour votre culture": "الأمراض المراقبة لزراعتك",
    "Note (facultatif) : rang, variété…": "ملاحظة (اختياري): الصف، الصنف…",
    "Diagnostic IA inactif : collez la clé Groq dans le fichier .env du serveur (GROQ_API_KEY=…) puis relancez-le. En attendant, chaque photo reçoit une analyse des couleurs (jaunissement, taches brunes, feutrage blanc).":
      "التشخيص بالذكاء الاصطناعي غير مفعل: الصق مفتاح Groq في ملف .env للخادم (GROQ_API_KEY=…) ثم أعد تشغيله. في الأثناء، تحصل كل صورة على تحليل للألوان (اصفرار، بقع بنية، زغب أبيض).",
    "Aucun diagnostic pour l'instant. Photographiez une feuille de près, à la lumière du jour : le système vous dira si elle est malade et quoi faire.":
      "لا يوجد تشخيص بعد. صوّر ورقة عن قرب في ضوء النهار: سيخبرك النظام إن كانت مريضة وماذا تفعل.",
    "Gardez une trace de l'état des cultures : feuilles abîmées, fruits, sol, matériel. Depuis un téléphone, l'appareil photo s'ouvre directement.": "احتفظ بأثر لحالة الزراعات: أوراق متضررة، ثمار، تربة، معدات. من الهاتف تُفتح الكاميرا مباشرة.",
    "Catégorie": "الفئة", "Feuilles": "الأوراق", "Fruits": "الثمار", "Matériel": "المعدات", "Note (facultatif)": "ملاحظة (اختياري)",
    "Ajouter une photo": "أضف صورة", "Toutes": "الكل", "Repères visuels · à comparer avec vos cultures": "مراجع بصرية · قارنها بزراعاتك",
    "Fruits sains, feuillage vert": "ثمار سليمة وأوراق خضراء", "Taches brunes : signe de maladie": "بقع بنية: علامة مرض",
    "Jeunes plants bien espacés": "شتلات متباعدة جيدا", "Goutte-à-goutte au pied des plantes": "التنقيط عند جذور النباتات",
    "Aucune photo pour l'instant. Ajoutez la première pour suivre l'évolution de vos cultures.": "لا توجد صور حاليا. أضف الأولى لمتابعة تطور زراعاتك.",
    "Photo ajoutée": "تمت إضافة الصورة", "Photo supprimée": "تم حذف الصورة", "Supprimer la photo": "احذف الصورة", "Fermer": "إغلاق",
    "Supprimer définitivement cette photo ?": "حذف هذه الصورة نهائيا؟",
    // conseiller
    "Le conseiller": "المستشار", "Nouvelle conversation": "محادثة جديدة", "Envoyer": "إرسال",
    "Votre question… · اكتب سؤالك": "اكتب سؤالك…", "Y a-t-il un risque de maladie cette semaine ?": "هل هناك خطر مرض هذا الأسبوع؟",
    "Disponible · répond en arabe, darija ou français": "متوفر · يجيب بالعربية أو الدارجة أو الفرنسية",
    "Réponses de base · ajoutez la clé ANTHROPIC_API_KEY pour un dialogue complet": "إجابات أساسية · أضف المفتاح ANTHROPIC_API_KEY لحوار كامل",
    "Vous": "أنت", "réponse de base": "إجابة أساسية",
    "السلام عليكم. Je suis votre conseiller agricole. Je vois en direct l'humidité du sol, la météo et l'état de vos cultures : posez-moi vos questions en arabe, en darija ou en français.": "السلام عليكم. أنا مستشارك الفلاحي. أرى مباشرة رطوبة التربة والطقس وحالة زراعاتك: اطرح أسئلتك بالعربية أو الدارجة أو الفرنسية.",
    "Je n'ai pas encore de mesure d'humidité du sol.": "لا يوجد لدي قياس لرطوبة التربة بعد.",
    "Réponse : oui, le sol est sec, il faut arroser (sauf si la pluie est prévue).": "الجواب: نعم، التربة جافة ويجب السقي (إلا إذا كان المطر متوقعا).",
    "Réponse : non, pas besoin d'arroser maintenant, le sol est assez humide.": "الجواب: لا، لا حاجة للسقي الآن، التربة رطبة بما يكفي.",
    "Causes possibles du jaunissement des feuilles :": "الأسباب المحتملة لاصفرار الأوراق:",
    "Recommandations de fertilisation selon vos capteurs :": "توصيات التسميد حسب مستشعراتك:",
    "Risques de maladies actuels :": "مخاطر الأمراض الحالية:",
    "Je suis le خبير فلاحي du système. Posez-moi des questions sur l'arrosage, les maladies, les engrais ou le jaunissement des feuilles.": "أنا الخبير الفلاحي للنظام. اسألني عن السقي أو الأمراض أو الأسمدة أو اصفرار الأوراق.",
    "(Réponse du mode local — ajoutez une clé ANTHROPIC_API_KEY pour un dialogue complet.)": "(إجابة أساسية — أضف المفتاح ANTHROPIC_API_KEY لحوار كامل.)",
    "👉 Non, pas besoin d'arroser maintenant, le sol est suffisamment humide.": "لا، لا حاجة للسقي الآن، التربة رطبة بما يكفي.",
    "👉 Oui, le sol est sec : il faut arroser (sauf si la pluie est prévue).": "نعم، التربة جافة: يجب السقي (إلا إذا كان المطر متوقعا).",
    "attente": "انتظار", "arrosage": "سقي", "reporté": "مؤجل", "arrêt": "توقف",
    // journal
    "Journal d'irrigation": "سجل السقي", "Date": "التاريخ", "Mode": "الوضع", "Durée": "المدة", "Humidité": "الرطوبة", "Motif": "السبب",
    "Auto": "تلقائي", "en cours": "جارٍ", "Aucun arrosage pour l'instant.": "لا توجد عمليات سقي حاليا.",
    // réglages
    "Apparence": "المظهر", "mémorisée sur cet appareil": "محفوظ على هذا الجهاز", "suit le mode clair / sombre de l'appareil": "يتبع الوضع الفاتح / الداكن للجهاز",
    "blanc, vert profond, bleu eau": "أبيض، أخضر داكن، أزرق مائي", "sombre, reposant le soir": "داكن، مريح في المساء",
    "turquoise, menthe, eau": "فيروزي، نعناعي، مائي", "sable, ocre, brun profond": "رملي، مغرة، بني داكن",
    "La parcelle": "الحقل", "Culture": "الزراعة", "Type de sol": "نوع التربة", "Latitude": "خط العرض", "Longitude": "خط الطول",
    "La position sert aux prévisions de pluie.": "يُستعمل الموقع لتوقعات المطر.", "Arrosage": "السقي",
    "Seuil d'humidité imposé": "عتبة رطوبة مفروضة", "Automatique selon sol et culture": "تلقائي حسب التربة والزراعة",
    "Durée maximale": "المدة القصوى", "Pause entre deux arrosages": "استراحة بين سقيتين", "Débit de la pompe": "تدفق المضخة",
    "Réponse du sol (s de pompe pour +1 %)": "استجابة التربة (ث مضخة لكل 1+ %)", "Le débit s'ajuste seul après chaque arrosage.": "يُضبط التدفق تلقائيا بعد كل سقي.",
    "Annuler si pluie prévue ≥": "إلغاء إذا كان المطر المتوقع ≥", "ou si probabilité ≥": "أو إذا كان الاحتمال ≥",
    "Enregistrer": "حفظ", "Réglages enregistrés": "تم حفظ الإعدادات", "s": "ث", "min": "د", "L / min": "ل / د", "mm / 12 h": "مم / 12 س",
    // palette de commandes
    "Aller à": "انتقل إلى", "vue d'ensemble": "نظرة عامة", "7 jours": "7 أيام", "galerie": "المعرض", "arrosages": "عمليات السقي",
    "parcelle, seuils": "الحقل، العتبات", "manuel": "يدوي", "Arroser 5 minutes": "اسقِ 5 دقائق", "Arroser 10 minutes": "اسقِ 10 دقائق",
    "Mode automatique": "الوضع التلقائي", "Mode manuel": "الوضع اليدوي", "Faut-il arroser aujourd'hui ?": "هل يجب السقي اليوم؟",
    "Quel engrais utiliser ?": "أي سماد أستعمل؟", "Risque de maladie ?": "خطر مرض؟", "Thème automatique": "مظهر تلقائي",
    "Thème clair": "مظهر فاتح", "Thème nuit": "مظهر ليلي", "Thème oasis": "مظهر واحة", "Thème désert": "مظهر صحراء",
    "Site": "الموقع", "Site de présentation": "موقع التقديم", "Apparence ": "المظهر", "naviguer": "تنقل", "exécuter": "تنفيذ", "ouvrir": "فتح",
    "Rechercher une action ou une page…": "ابحث عن إجراء أو صفحة…", "Échap": "خروج", "Entrée": "إدخال",
    "Palette de commandes": "لوحة الأوامر", "Langue arabe": "اللغة العربية", "Langue française": "اللغة الفرنسية", "Copié": "تم النسخ",
    "Pompe arrêtée ": "المضخة متوقفة",
    // journal
    "Tous": "الكل", "Mode d'arrosage": "طريقة السقي",
    // diagnostic des photos
    "IA": "الذكاء الاصطناعي", "Intelligence artificielle (Claude)": "الذكاء الاصطناعي (Claude)",
    "Active le diagnostic des photos et le conseiller complet. La clé reste sur cet ordinateur.": "يفعّل تشخيص الصور والمستشار الكامل. يبقى المفتاح على هذا الحاسوب.",
    "Enregistrer la clé": "حفظ المفتاح", "Retirer la clé": "إزالة المفتاح", "Clé Claude enregistrée": "تم حفظ مفتاح Claude", "Clé retirée": "تمت إزالة المفتاح",
    "Clé enregistrée : diagnostic des photos et conseiller complet actifs.": "المفتاح محفوظ: تشخيص الصور والمستشار الكامل مفعّلان.",
    "Aucune clé : diagnostic IA et conseiller complet inactifs.": "لا يوجد مفتاح: التشخيص بالذكاء الاصطناعي والمستشار الكامل غير مفعّلين.",
    "Chaque diagnostic de photo coûte une fraction de centime. Ne partagez jamais cette clé.": "كل تشخيص لصورة يكلف جزءا صغيرا من السنتيم. لا تشارك هذا المفتاح أبدا.",
    "Diagnostic par IA :": "التشخيص بالذكاء الاصطناعي:",
    "photographiez une feuille ou un fruit de près, à la lumière du jour. L'IA reconnaît la plante, les symptômes et les maladies probables.": "صوّر ورقة أو ثمرة عن قرب وفي ضوء النهار. يتعرف الذكاء الاصطناعي على النبتة والأعراض والأمراض المحتملة.",
    "Diagnostic IA inactif : le propriétaire doit ajouter la clé Claude dans Réglages › IA. En attendant, chaque photo reçoit une analyse des couleurs.": "التشخيص بالذكاء الاصطناعي غير مفعّل: يجب على المالك إضافة مفتاح Claude في الإعدادات › الذكاء الاصطناعي. في الأثناء، تحصل كل صورة على تحليل للألوان.",
    "Analyse IA…": "تحليل…", "Pas de plante reconnue": "لم يتم التعرف على نبتة", "✓ Plante saine": "✓ نبتة سليمة", "Stress": "إجهاد",
    "À surveiller": "للمراقبة", "Analyse impossible": "التحليل غير ممكن", "Plante saine": "نبتة سليمة", "Maladie probable": "مرض محتمل",
    "Plante stressée": "نبتة مجهدة", "Diagnostic incertain": "تشخيص غير مؤكد", "Aucune urgence": "لا استعجال", "Urgence faible": "استعجال ضعيف",
    "Urgence moyenne": "استعجال متوسط", "Urgence haute": "استعجال كبير", "Hypothèses": "الفرضيات", "Que faire ?": "ماذا أفعل؟",
    "Diagnostic par IA à partir d'une seule photo : à confirmer par un technicien agricole avant tout traitement.": "تشخيص بالذكاء الاصطناعي من صورة واحدة: يجب تأكيده من طرف تقني فلاحي قبل أي معالجة.",
    "Diagnostic IA en cours…": "التشخيص جارٍ…", "L'IA examine la photo et les mesures de la parcelle (10 à 30 secondes).": "يفحص الذكاء الاصطناعي الصورة وقياسات الحقل (10 إلى 30 ثانية).",
    "Analyse des couleurs": "تحليل الألوان", "Lancer le diagnostic IA": "بدء التشخيص بالذكاء الاصطناعي", "Relancer le diagnostic IA": "إعادة التشخيص",
    "Pour un vrai diagnostic de maladie par IA, le propriétaire ajoute la clé Claude dans Réglages › IA.": "لتشخيص حقيقي للأمراض بالذكاء الاصطناعي، يضيف المالك مفتاح Claude في الإعدادات › الذكاء الاصطناعي.",
    "Aucune analyse pour cette photo.": "لا يوجد تحليل لهذه الصورة.", "Photo ajoutée · diagnostic IA en cours…": "تمت إضافة الصورة · التشخيص جارٍ…",
    "Peu de végétation visible : photographiez la feuille de plus près.": "القليل من النبات ظاهر: صوّر الورقة عن قرب.",
    "Couleurs surtout vertes : pas de signe visible de jaunissement ou de taches.": "الألوان خضراء في الغالب: لا توجد علامات ظاهرة للاصفرار أو البقع.",
    "Zones blanchâtres : peut indiquer un feutrage d'oïdium (ou un reflet de lumière).": "مناطق بيضاء: قد تدل على البياض الدقيقي (أو انعكاس للضوء).",
    "Aucune photo pour l'instant. Photographiez une feuille de près, à la lumière du jour : l'IA vous dira si elle est malade.": "لا توجد صور حاليا. صوّر ورقة عن قرب في ضوء النهار: سيخبرك الذكاء الاصطناعي إن كانت مريضة.",
    "Clé Claude refusée : vérifiez-la dans Réglages › IA.": "تم رفض مفتاح Claude: تحقق منه في الإعدادات › الذكاء الاصطناعي.",
    "Crédit Claude épuisé ou limite atteinte : réessayez plus tard.": "نفد رصيد Claude أو تم بلوغ الحد: أعد المحاولة لاحقا.",
    "Pas de connexion à Internet : réessayez dans un instant.": "لا يوجد اتصال بالإنترنت: أعد المحاولة بعد قليل.",
    "Intelligence artificielle": "الذكاء الاصطناعي",
    "Active le diagnostic des maladies sur les photos et le conseiller complet. La clé reste sur cet ordinateur.": "يفعّل تشخيص الأمراض في الصور والمستشار الكامل. يبقى المفتاح على هذا الحاسوب.",
    "Gratuit pour commencer · très rapide": "مجاني للبداية · سريع جدا", "Payant · diagnostic plus précis": "مدفوع · تشخيص أدق",
    "Tester et enregistrer": "اختبار وحفظ", "Ne partagez jamais cette clé.": "لا تشارك هذا المفتاح أبدا.",
    "Vérification de la clé…": "جارٍ التحقق من المفتاح…", "Clé vérifiée et enregistrée.": "تم التحقق من المفتاح وحفظه.",
    "Clé Groq enregistrée": "تم حفظ مفتاح Groq", "Collez d'abord la clé.": "الصق المفتاح أولا.",
    "Clé Groq refusée : vérifiez-la dans Réglages › IA.": "تم رفض مفتاح Groq: تحقق منه في الإعدادات › الذكاء الاصطناعي.",
    "Limite Groq atteinte (trop de demandes) : réessayez dans une minute.": "تم بلوغ حد Groq: أعد المحاولة بعد دقيقة.",
    "Cette clé ne ressemble pas à une clé Groq (elle commence par gsk_).": "هذا لا يشبه مفتاح Groq (يبدأ بـ gsk_).",
    "Diagnostic IA inactif : le propriétaire doit ajouter une clé Groq dans Réglages › IA. En attendant, chaque photo reçoit une analyse des couleurs.": "التشخيص بالذكاء الاصطناعي غير مفعّل: يجب على المالك إضافة مفتاح Groq في الإعدادات › الذكاء الاصطناعي. في الأثناء، تحصل كل صورة على تحليل للألوان.",
    "Pour un vrai diagnostic de maladie par IA, collez la clé Groq dans le fichier .env du serveur.": "لتشخيص حقيقي للأمراض بالذكاء الاصطناعي، الصق مفتاح Groq في ملف .env للخادم.",
    "Ma parcelle": "حقلي", "Rubriques des réglages": "أقسام الإعدادات",
    // à propos
    "À propos": "من نحن", "Startup algérienne de l'irrigation intelligente": "شركة ناشئة جزائرية للسقي الذكي", "Version 2.0": "الإصدار 2.0",
    "Notre mission": "مهمتنا", "Aider les agriculteurs algériens à arroser au bon moment : économiser l'eau et l'électricité, protéger les récoltes des maladies, et rendre la technologie simple pour tous, en arabe, en darija et en français.": "مساعدة الفلاحين الجزائريين على السقي في الوقت المناسب: توفير الماء والكهرباء، وحماية المحاصيل من الأمراض، وجعل التكنولوجيا بسيطة للجميع، بالعربية والدارجة والفرنسية.",
    "Pourquoi « Sāqiya » ?": "لماذا « الساقية »؟", "— la rigole qui amène l'eau jusqu'aux cultures dans l'irrigation traditionnelle. Nous gardons cette idée simple, avec des capteurs et de l'intelligence artificielle.": "— القناة التي توصل الماء إلى الزراعات في السقي التقليدي. نحافظ على هذه الفكرة البسيطة، مع المستشعرات والذكاء الاصطناعي.", "Ce que fait le système": "ماذا يفعل النظام", "Fabriqué en Algérie": "صُنع في الجزائر",
    "Arrose automatiquement selon l'humidité du sol et la pluie annoncée": "يسقي تلقائيا حسب رطوبة التربة والمطر المتوقع",
    "Prévoit les risques de maladies avant les premiers symptômes": "يتوقع مخاطر الأمراض قبل ظهور الأعراض الأولى",
    "Conseille l'agriculteur en arabe, en darija et en français": "ينصح الفلاح بالعربية والدارجة والفرنسية",
    "Envoie les alertes sur le téléphone et calcule les coûts": "يرسل التنبيهات إلى الهاتف ويحسب التكاليف",
    "Boîtier ESP32, serveur et tableau de bord conçus et développés en Algérie, pour nos cultures (Mitidja, Hauts Plateaux, oasis du Sud) et notre climat.": "الجهاز ESP32 والخادم ولوحة التحكم صُممت وطُورت في الجزائر، لزراعاتنا (المتيجة، الهضاب العليا، واحات الجنوب) ولمناخنا.",
    "Startup algérienne de l'irrigation intelligente.": "شركة ناشئة جزائرية للسقي الذكي.",
    "Sāqiya · Photos : Unsplash (licence Unsplash) · Prévisions météo : Open-Meteo": "الساقية · الصور: Unsplash · توقعات الطقس: Open-Meteo",
    // programmation, coûts, alertes, rapport
    "Programmation horaire": "البرمجة الزمنية", "Choisissez quand la pompe a le droit de tourner, et programmez des arrosages à heure fixe.": "اختر متى يُسمح للمضخة بالعمل، وبرمج سقيا في ساعة محددة.",
    "Arroser seulement dans ces créneaux": "السقي فقط في هذه الفترات", "Évite d'arroser en plein soleil (l'eau s'évapore).": "تجنب السقي تحت الشمس الحارقة (الماء يتبخر).",
    "+ Ajouter un créneau": "+ إضافة فترة", "Arrosages programmés": "عمليات سقي مبرمجة", "Lancés à l'heure dite, même en mode manuel.": "تنطلق في الوقت المحدد، حتى في الوضع اليدوي.",
    "+ Programmer un arrosage": "+ برمجة سقي", "Aucun arrosage programmé.": "لا يوجد سقي مبرمج.", "Seulement si le sol n'est pas déjà humide": "فقط إذا لم تكن التربة رطبة",
    "Coûts": "التكاليف", "Pour estimer ce que coûte l'arrosage (rapport et analyses).": "لتقدير تكلفة السقي (التقرير والتحاليل).",
    "Prix de l'eau": "سعر الماء", "Prix de l'électricité": "سعر الكهرباء", "Puissance de la pompe": "قدرة المضخة", "Monnaie": "العملة",
    "Ouvrir le rapport (PDF)": "فتح التقرير (PDF)", "Rapport PDF": "تقرير PDF", "Alertes sur le téléphone": "التنبيهات على الهاتف",
    "Recevez les alertes sur Telegram (gratuit) : sol sec, maladies, pompe, boîtier débranché, résumé du matin.": "استقبل التنبيهات على تيليغرام (مجانا): تربة جافة، أمراض، المضخة، جهاز مفصول، ملخص الصباح.",
    "Détecter": "اكتشاف", "Alertes (sol, maladies)": "تنبيهات (التربة، الأمراض)", "Début et fin d'arrosage": "بداية ونهاية السقي",
    "Boîtier débranché": "جهاز مفصول", "Résumé chaque matin à 7 h": "ملخص كل صباح على الساعة 7", "Langue des messages": "لغة الرسائل",
    "Envoyer un message de test": "إرسال رسالة تجريبية", "Ajouter un téléphone": "إضافة هاتف", "Désactiver": "إيقاف",
    "Message envoyé : regardez votre téléphone.": "تم الإرسال: انظر إلى هاتفك.", "Recherche…": "جارٍ البحث…", "Arrosage programmé": "سقي مبرمج",
    "Rapport d'irrigation": "تقرير السقي", "En résumé": "باختصار", "Arrosages": "عمليات السقي", "Temps de pompage": "مدة الضخ",
    "Électricité": "الكهرباء", "Coût de l'eau": "تكلفة الماء", "Coût de l'électricité": "تكلفة الكهرباء", "Coût total": "التكلفة الإجمالية",
    "Eau par jour (moyenne)": "الماء في اليوم (معدل)", "Eau et humidité, jour par jour": "الماء والرطوبة يوما بيوم", "Jour": "اليوم",
    "Pompage": "الضخ", "Eau (L)": "الماء (ل)", "Humidité moy.": "متوسط الرطوبة", "T° min / max": "الحرارة الدنيا / القصوى", "Total": "المجموع",
    "Types d'arrosage": "أنواع السقي", "Sol (moyennes)": "التربة (المتوسطات)", "Alertes de la période": "تنبيهات الفترة", "Hypothèses de calcul": "فرضيات الحساب",
    "Aucune alerte.": "لا توجد تنبيهات.", "Programmé": "مبرمج", "Imprimer / Enregistrer en PDF": "طباعة / حفظ PDF", "Afficher": "عرض",
    "← Retour au tableau de bord": "العودة إلى لوحة التحكم →", "Du": "من", "au": "إلى", "Irrigation intelligente": "السقي الذكي",
    "Aucune donnée sur cette période.": "لا توجد بيانات في هذه الفترة.", "Eau d'irrigation par jour (litres)": "ماء السقي في اليوم (لترات)",
    "Humidité moyenne du sol": "متوسط رطوبة التربة", "Chargement du rapport…": "جارٍ تحميل التقرير…",
    // comptes
    "Propriétaire": "المالك", "Membre": "عضو", "Comptes": "الحسابات", "Se déconnecter": "تسجيل الخروج", "Compte": "الحساب",
    "Les personnes qui ont un compte. Vous pouvez suspendre ou supprimer un compte à tout moment.": "الأشخاص الذين لديهم حساب. يمكنك إيقاف أو حذف أي حساب في أي وقت.",
    "Ouvrir le compte": "تفعيل الحساب", "Refuser": "رفض", "Suspendre": "إيقاف", "Supprimer": "حذف", "En attente": "في الانتظار",
    "Compte ouvert": "حساب مفعّل", "Compte suspendu": "تم إيقاف الحساب", "Compte supprimé": "تم حذف الحساب",
    "Connexion Google activée": "تم تفعيل الدخول عبر Google", "Connexion Google désactivée": "تم إيقاف الدخول عبر Google",
    "Supprimer ce compte ? La personne ne pourra plus se connecter.": "حذف هذا الحساب؟ لن يتمكن صاحبه من الدخول.",
    "Chaque arrosage, avec la raison et le résultat.": "كل عملية سقي مع سببها ونتيجتها.", "Période": "الفترة", "Type d'arrosage": "نوع السقي",
    "Exporter (CSV)": "تصدير (CSV)", "Eau par jour": "الماء في اليوم", "Eau par heure": "الماء في الساعة", "Arrosages": "عمليات السقي",
    "Eau utilisée": "الماء المستعمل", "Durée moyenne": "متوسط المدة", "par arrosage": "لكل سقي", "Part automatique": "نسبة التلقائي",
    "Aucun arrosage": "لا يوجد سقي", "sur 24 h": "خلال 24 ساعة", "Aujourd'hui": "اليوم", "Hier": "أمس",
    "Arrosage automatique": "سقي تلقائي", "Arrosage manuel": "سقي يدوي", "En cours": "جارٍ", "7 j": "7 أيام", "30 j": "30 يوما",
    "Aucun arrosage sur cette période": "لا يوجد سقي في هذه الفترة",
    "Les arrosages apparaîtront ici dès que la pompe aura fonctionné.": "ستظهر عمليات السقي هنا بمجرد تشغيل المضخة.", "Journal exporté": "تم تصدير السجل",
    // paramètres
    "Paramètres": "الإعدادات", "Réglez votre parcelle une fois : le système s'occupe du reste.": "اضبط حقلك مرة واحدة: النظام يتكفل بالباقي.",
    "Ma culture": "زراعتي", "Les seuils d'arrosage et la surveillance des maladies s'adaptent à la culture.": "تتكيف عتبات السقي ومراقبة الأمراض مع نوع الزراعة.",
    "Mon sol": "تربتي", "Un sol sableux sèche vite, un sol argileux garde l'eau longtemps.": "التربة الرملية تجف بسرعة، والطينية تحتفظ بالماء طويلا.",
    "En automatique, la pompe démarre seule quand le sol est sec.": "في الوضع التلقائي تشتغل المضخة وحدها عندما تجف التربة.",
    "Le système décide": "النظام يقرر", "Vous décidez": "أنت تقرر", "Seuil de déclenchement": "عتبة التشغيل",
    "Automatique selon le sol et la culture": "تلقائي حسب التربة والزراعة", "Durées et pompe": "المدد والمضخة",
    "Des limites pour ne jamais trop arroser.": "حدود حتى لا تسقي أكثر من اللازم.", "Durée maximale d'un arrosage": "المدة القصوى للسقي", "Aucune": "بدون",
    "Si la pluie est annoncée, le système attend et économise l'eau.": "إذا أُعلن عن المطر ينتظر النظام ويوفر الماء.",
    "Ne pas arroser si la pluie prévue dépasse": "لا تسقِ إذا تجاوز المطر المتوقع", "ou si la probabilité de pluie dépasse": "أو إذا تجاوز احتمال المطر",
    "Position de la parcelle": "موقع الحقل", "Sert aux prévisions de pluie de votre région.": "يُستعمل لتوقعات المطر في منطقتك.", "Utiliser ma position": "استعمل موقعي",
    "Langue de tout le tableau de bord.": "لغة لوحة التحكم كلها.", "Interface en français": "الواجهة بالفرنسية", "Réglages avancés": "إعدادات متقدمة",
    "Réponse du sol (secondes de pompe pour +1 % d'humidité)": "استجابة التربة (ثواني تشغيل المضخة لكل 1+ % رطوبة)",
    "Cette valeur s'ajuste seule après chaque arrosage. Ne la changez que si vous savez pourquoi.": "تُضبط هذه القيمة تلقائيا بعد كل سقي. لا تغيرها إلا إذا كنت تعرف السبب.",
    "Modifications non enregistrées": "تعديلات غير محفوظة", "Annuler": "إلغاء",
    "Sableux": "رملية", "Limoneux": "طميية", "Limono-argileux": "طينية طميية", "Argileux": "طينية",
    "Léger, sèche vite": "خفيفة، تجف بسرعة", "Équilibré, garde bien l'eau": "متوازنة، تحتفظ جيدا بالماء",
    "Riche, garde l'eau longtemps": "غنية، تحتفظ بالماء طويلا", "Lourd, reste humide": "ثقيلة، تبقى رطبة",
    "La localisation n'est possible que depuis l'ordinateur du serveur (adresse localhost). Sinon, saisissez les coordonnées.": "تحديد الموقع ممكن فقط من حاسوب الخادم (العنوان localhost). وإلا أدخل الإحداثيات يدويا.",
    "Recherche de votre position…": "جارٍ البحث عن موقعك…", "Position trouvée. N'oubliez pas d'enregistrer.": "تم العثور على الموقع. لا تنس الحفظ.",
    "Position refusée ou indisponible. Saisissez les coordonnées à la main.": "الموقع مرفوض أو غير متوفر. أدخل الإحداثيات يدويا.",
  };

  /* ---------------- modèles de phrases ---------------- */
  const sub = (x) => tr(x) ?? x;
  const P = [
    [/^Dehors ([\d,.-]+) °C, ([\d,.-]+) % d'humidité$/, "في الخارج $1 °C، رطوبة $2 %"],
    [/^Dernier relevé (.+)$/, "آخر قياس $1"],
    [/^idéal (.+) %$/, "المثالي $1 %"],
    [/^Le sol est passé sous (.+) %\. Arrosage en cours jusqu'à (.+) %\.$/, "انخفضت رطوبة التربة تحت $1 %. السقي جارٍ حتى $2 %."],
    [/^dans (\d+) min$/, "بعد $1 دقيقة"], [/^dans ([\d,]+) h$/, "بعد $1 ساعة"],
    [/^(\d+) × · (\d+) min$/, "$1 مرات · $2 دقيقة"], [/^([\d,]+) s \/ %$/, "$1 ث / %"],
    [/^(\d+):(\d\d) restant$/, "متبقٍ $1:$2"], [/^Arrosage lancé pour (\d+) min$/, "بدأ السقي لمدة $1 دقيقة"],
    [/^(\d+) min$/, "$1 دقيقة"], [/^(\d+) h$/, "$1 س"],
    [/^([\d,]+) mm de pluie attendus$/, "يُتوقع $1 مم من المطر"],
    [/^hors plage (.+)$/, "خارج المجال $1"], [/^plage (.+)$/, "المجال $1"],
    [/^au-dessus de (.+)$/, "أعلى من $1"], [/^max\. toléré (.+)$/, "الحد المسموح $1"],
    [/^bas \(idéal (.+)\)$/, "منخفض (المثالي $1)"], [/^élevé \(idéal (.+)\)$/, "مرتفع (المثالي $1)"], [/^bon \(idéal (.+)\)$/, "جيد (المثالي $1)"],
    [/^idéal (.+)$/, "المثالي $1"], [/^(.+) · maintenant$/, "$1 · الآن"],
    [/^(.+) µS\/cm · au-dessus de (.+)$/, "$1 µS/cm · أعلى من $2"], [/^(.+) µS\/cm · max\. (.+)$/, "$1 µS/cm · الحد $2"],
    [/^relevé de (.+) · courbes sur 6 h$/, "قياس الساعة $1 · منحنيات 6 ساعات"],
    [/^(\d+) risques? à surveiller$/, "$1 خطر للمراقبة"],
    [/^Calculé sur les dernières heures : (.+) °C en moyenne, (.+) % d'humidité, feuillage humide ~(.+) h sur 24 h\.$/, "محسوب على الساعات الأخيرة: متوسط $1 °C، رطوبة $2 %، أوراق مبللة حوالي $3 ساعة من 24."],
    [/^(\d+) à lire$/, "$1 غير مقروءة"],
    [/^(\d+) arrosages? · (\d+) min de pompe au total$/, "$1 عملية سقي · $2 دقيقة تشغيل للمضخة"],
    [/^(\d+) min (\d+) s$/, "$1 د $2 ث"],
    [/^Thème « (.+) »$/, (m, a) => `المظهر « ${sub(a)} »`],
    [/^≈ (.+) L par jour$/, "≈ $1 لتر في اليوم"], [/^(.+) par jour en moyenne$/, "$1 في اليوم كمعدل"],
    [/^cible (.+) %$/, "الهدف $1 %"], [/^litres estimés · pompe (.+) L\/min$/, "لترات تقديرية · مضخة $1 ل/د"],
    [/^min (.+) % · max (.+) %$/, "الأدنى $1 % · الأقصى $2 %"], [/^moyenne (.+) %$/, "المتوسط $1 %"],
    [/^max (.+) °C$/, "الأقصى $1 °C"], [/^min (.+) °C$/, "الأدنى $1 °C"],
    [/^(.+) L · (\d+) arrosage\(s\)$/, "$1 لتر · $2 سقي"],
    [/^(.+) % · (faible|moyen|élevé)$/, (m, a, b) => `${a} % · ${sub(b)}`],
    [/^(.+?) · (Nuit|Lever du jour|Journée|Fin de journée)$/, (m, a, b) => `${a} · ${{ "Nuit": "ليل", "Lever du jour": "شروق", "Journée": "نهار", "Fin de journée": "غروب" }[b]}`],
    [/^(Quelques nuages|Ciel dégagé) · (.+) °C$/, (m, a, b) => `${a === "Ciel dégagé" ? "سماء صافية" : "بعض السحب"} · ${b} °C`],
    [/^Pluie probable \((\d+) %\) · (.+) °C$/, "مطر محتمل ($1 %) · $2 °C"],
    [/^(Conseiller|Vous) · (.+)$/, (m, who, rest) => `${who === "Vous" ? "أنت" : "المستشار"} · ${rest.split(" · ").map(sub).join(" · ")}`],
    [/^Le message n'a pas pu être envoyé : (.+)$/, "تعذر إرسال الرسالة: $1"],
    [/^Envoi impossible : (.+)$/, "تعذر الإرسال: $1"], [/^Impossible d'enregistrer : (.+)$/, "تعذر الحفظ: $1"],
    [/^Aucune commande pour « (.+) »$/, "لا يوجد أمر لـ « $1 »"],
    [/^Il manque environ (\d+) points pour atteindre l'objectif\.$/, "ينقص حوالي $1 نقطة لبلوغ الهدف."],
    [/^Sol sec \((.+) %\) mais hors des créneaux d'arrosage(?: : prochain créneau à (.+))?\.$/, (m, a, b) => `التربة جافة (${a} %) لكن خارج فترات السقي${b ? `: الفترة القادمة على ${b}` : ""}.`],
    [/^Arrosage programmé de (.+) annulé : sol déjà humide \((.+) % ≥ (.+) %\)\.$/, "تم إلغاء سقي الساعة $1: التربة رطبة ($2 % ≥ $3 %)."],
    [/^Arrosage programmé de (.+) annulé : pluie prévue \((.+) mm\)\.$/, "تم إلغاء سقي الساعة $1: المطر متوقع ($2 مم)."],
    [/^Arrosage programmé de (.+) \((\d+) min\)\.$/, "سقي مبرمج على الساعة $1 ($2 دقيقة)."],
    [/^Arrosage programmé de (.+) pendant (\d+) min\.$/, "سقي مبرمج على الساعة $1 لمدة $2 دقيقة."],
    [/^Relié à : (.+)$/, "مربوط بـ: $1"], [/^Coût \((.+)\)$/, "التكلفة ($1)"], [/^Généré le (.+)$/, "أُنشئ في $1"],
    [/^≈ (.+) L par jour · (.+)$/, "≈ $1 لتر في اليوم · $2"],
    [/^La (.+) est la rigole qui amène l'eau jusqu'aux cultures dans l'irrigation traditionnelle\. Nous gardons cette idée simple, avec des capteurs et de l'intelligence artificielle\.$/, "الساقية هي القناة التي توصل الماء إلى الزراعات في السقي التقليدي. نحافظ على هذه الفكرة البسيطة، مع المستشعرات والذكاء الاصطناعي."],
    [/^© (\d+) Sāqiya · Photos : Unsplash \(licence Unsplash\) · Prévisions météo : Open-Meteo$/, "© $1 الساقية · الصور: Unsplash · توقعات الطقس: Open-Meteo"],
    [/^(\d+) % de la plante est jaune : possible manque d'azote, excès d'eau ou chlorose\.$/, "$1 % من النبتة أصفر: ربما نقص الآزوت أو ماء زائد أو اصفرار."],
    [/^(\d+) % de zones brunes : taches ou nécroses, à surveiller \(mildiou, brûlure, carence\)\.$/, "$1 % مناطق بنية: بقع أو تلف، يجب المراقبة (البياض الزغبي، حروق، نقص)."],
    [/^Jaune (\d+) % · brun (\d+) %$/, "أصفر $1 % · بني $2 %"], [/^(Vert|Jaune|Brun|Blanc) (\d+) %$/, (m, c, n) => `${{ Vert: "أخضر", Jaune: "أصفر", Brun: "بني", Blanc: "أبيض" }[c]} ${n} %`],
    [/^(Groq|Claude) actif : diagnostic des photos et conseiller complet\.$/, "$1 مفعّل: تشخيص الصور والمستشار الكامل."],
    [/^Aucune clé (Groq|Claude) : diagnostic IA et conseiller complet inactifs\.$/, "لا يوجد مفتاح $1: التشخيص والمستشار الكامل غير مفعّلين."],
    [/^sur (\d+) jours$/, "خلال $1 أيام"], [/^≈ (\d+) L$/, "≈ $1 لتر"], [/^(\d+) s$/, "$1 ث"],
    [/^Dernier arrosage il y a (\d+) (min|h|j)$/, (m, n, u) => `آخر سقي منذ ${n} ${{ min: "دقيقة", h: "ساعة", j: "يوم" }[u]}`],
    [/^Automatique \((.+) %\)$/, "تلقائي ($1 %)"], [/^([\d,]+) mm$/, "$1 مم"], [/^(\d+) h (\d+) min$/, "$1 س $2 د"],
    // décisions du serveur
    [/^Sol suffisamment humide \((.+) % ≥ seuil (.+) %\)\.$/, "التربة رطبة بما يكفي ($1 % ≥ العتبة $2 %)."],
    [/^Humidité cible atteinte \((.+) % ≥ (.+) %\)\.$/, "تم بلوغ الرطوبة المستهدفة ($1 % ≥ $2 %)."],
    [/^Sol sec \((.+) %\) mais pluie prévue \((.+) mm, (.+) %\) dans les 12 h : économie d'eau\.$/, "التربة جافة ($1 %) لكن المطر متوقع ($2 مم، $3 %) خلال 12 ساعة: توفير للماء."],
    [/^Sol sec mais dernier arrosage trop récent \(attendre ~(\d+) min pour que l'eau diffuse\)\.$/, "التربة جافة لكن آخر سقي حديث جدا (انتظر حوالي $1 دقيقة حتى ينتشر الماء)."],
    [/^Humidité (.+) % < seuil (.+) %, pas de pluie prévue\. Objectif (.+) % → (\d+) s de pompe\.(.*)$/, (m, a, b, c, d, e) => `الرطوبة ${a} % < العتبة ${b} %، لا مطر متوقع. الهدف ${c} % ← ${d} ث تشغيل للمضخة.${sub(e)}`],
    [/^Humidité (.+) % < seuil (.+) %, pas de pluie prévue\.(.*)$/, (m, a, b, c) => `الرطوبة ${a} % < العتبة ${b} %، لا مطر متوقع.${sub(c)}`],
    [/^Arrosage manuel pendant (\d+) s\.$/, "سقي يدوي لمدة $1 ث."], [/^Démarrage manuel(.*)$/, (m, a) => "تشغيل يدوي" + sub(a)],
    [/^Prochain arrosage estimé dans ~(.+) h\.$/, "السقي القادم متوقع بعد حوالي $1 ساعة."],
    [/^\(interrompu : redémarrage du serveur\)$/, "(توقف: إعادة تشغيل الخادم)"],
    [/^Aucune mesure reçue pour l'instant\.$/, "لم يتم استلام أي قياس بعد."], [/^Durée d'arrosage atteinte\.$/, "انتهت مدة السقي."],
    [/^Pluie détectée pendant l'arrosage : arrêt de la pompe\.$/, "تم رصد المطر أثناء السقي: توقيف المضخة."],
    [/^Mode manuel : aucune décision automatique\.$/, "الوضع اليدوي: لا قرار تلقائي."],
    [/^Capteur d'humidité du sol indisponible\.$/, "مستشعر رطوبة التربة غير متوفر."],
    [/^Sol sec mais il pleut actuellement : arrosage annulé\.$/, "التربة جافة لكنها تمطر الآن: تم إلغاء السقي."],
    [/^Pompe arrêtée manuellement\.$/, "تم إيقاف المضخة يدويا."],
    // sol
    [/^Sol trop acide \(pH (.+) < (.+)\) : les éléments nutritifs sont moins disponibles\.$/, "التربة حمضية جدا (pH $1 < $2): العناصر الغذائية أقل توفرا."],
    [/^Sol trop alcalin \(pH (.+) > (.+)\) : risque de chlorose ferrique\.$/, "التربة قلوية جدا (pH $1 > $2): خطر الاصفرار الحديدي."],
    [/^pH (.+) adapté à la culture \((.+)\)\.$/, "pH $1 مناسب للزراعة ($2)."],
    [/^Salinité élevée \(EC (.+) dS\/m > (.+)\) : stress pour la plante\.$/, "ملوحة مرتفعة (EC $1 dS/m > $2): إجهاد للنبات."],
    [/^Salinité acceptable \(EC (.+) dS\/m\)\.$/, "ملوحة مقبولة (EC $1 dS/m)."],
    [/^([NPK]) faible \((.+) mg\/kg < (.+)\) — rôle : (.+)\.$/, (m, k, v, lo, role) => `${k} منخفض (${v} ملغ/كغ < ${lo}) — دوره: ${sub(role)}.`],
    [/^([NPK]) élevé \((.+) mg\/kg\)\.$/, "$1 مرتفع ($2 ملغ/كغ)."], [/^([NPK]) correct \((.+) mg\/kg\)\.$/, "$1 جيد ($2 ملغ/كغ)."],
    [/^Sol : (.+) (bas|haut)$/, (m, p, s) => `التربة: ${p} ${s === "bas" ? "منخفض" : "مرتفع"}`],
    [/^Risque élevé : (.+)$/, (m, a) => `خطر مرتفع: ${sub(a)}`],
    [/^Conditions favorables détectées \((.+) %\)\. Prévention : (.+)$/, (m, a, b) => `ظروف ملائمة للمرض (${a} %). الوقاية: ${sub(b)}`],
    // conseiller (réponses de base)
    [/^Humidité du sol actuelle : (.+) % \(seuil (.+) %, cible (.+) %\)\.$/, "رطوبة التربة الحالية: $1 % (العتبة $2 %، الهدف $3 %)."],
    [/^Pluie prévue sur 12 h : (.+) mm \(probabilité max (.+) %\)\.$/, "المطر المتوقع خلال 12 ساعة: $1 مم (أقصى احتمال $2 %)."],
    [/^Décision du système : (\S+) — (.*)$/, (m, a, b) => `قرار النظام: ${sub(a)} — ${sub(b)}`],
    [/^D'après vos capteurs : (.+)$/, (m, a) => `حسب مستشعراتك: ${sub(a)}`],
    [/^Les niveaux N-P-K, pH et salinité mesurés sont corrects : un engrais d'entretien équilibré suffit\. ?(.*)$/, (m, a) => `مستويات N-P-K والحموضة والملوحة المقاسة جيدة: يكفي سماد صيانة متوازن. ${sub(a)}`],
    [/^État actuel : sol (.+) %, air (.+) °C \/ (.+) %\.$/, "الحالة الحالية: التربة $1 %، الهواء $2 °C / $3 %."],
    [/^\(Conseiller complet indisponible : (.+)\.\)$/, "(المستشار الكامل غير متوفر: $1.)"],
    [/^(.+) : (.+) % \((faible|moyen|élevé)\) — (.+)$/, (m, a, b, c, d) => `${sub(a)}: ${b} % (${sub(c)}) — ${sub(d)}`],
  ];

  /* textes longs remplacés à l'intérieur des phrases (base agronomique + conseils du sol) */
  let PHR = [
    ["Chaulage (calcaire broyé ou dolomie), à ajuster selon une analyse de sol.", "إضافة الجير (حجر جيري مطحون أو دولوميت)، تُضبط الكمية حسب تحليل التربة."],
    ["Engrais acidifiants (sulfate d'ammonium), soufre élémentaire, matière organique ; chélates de fer si chlorose.", "أسمدة محمضة (سلفات الأمونيوم)، كبريت، مادة عضوية؛ وحديد مخلبي عند الاصفرار."],
    ["Irrigation de lessivage avec une eau peu salée, éviter le chlorure de potassium, améliorer le drainage.", "سقي غسيل بماء قليل الملوحة، تجنب كلورور البوتاسيوم، تحسين الصرف."],
  ];

  const HAS_LATIN = /[A-Za-zÀ-ÿ]/;
  const AR_IN_PARENS = /^(.+?) \(([\u0600-\u06FF][^()]*)\)$/;

  function tr(text) {
    if (text == null) return null;
    const k = String(text).trim();
    if (!k || !HAS_LATIN.test(k)) return null;
    if (k.includes("\n")) {
      const lines = k.split("\n").map((l) => sub(l));
      const out = lines.join("\n");
      return out !== k ? out : null;
    }
    if (D[k] != null) return D[k];
    const p = AR_IN_PARENS.exec(k);
    if (p) return p[2];
    for (const [re, rep] of P) {
      if (re.test(k)) return k.replace(re, rep);
    }
    if (k.startsWith("• ")) return "• " + sub(k.slice(2));
    for (const [fr, ar] of PHR) if (k === fr) return ar;
    let out = k;
    for (const [fr, ar] of PHR) if (out.includes(fr)) out = out.split(fr).join(ar);
    if (out !== k) return out;
    for (const sep of [" Conseil : ", " → ", " — "]) {
      if (k.includes(sep)) {
        const joined = k.split(sep).map((x) => sub(x)).join(sep === " Conseil : " ? " النصيحة: " : sep);
        if (joined !== k) return joined;
      }
    }
    return null;
  }
  window.tr = tr;

  /* ---------------- application au document ---------------- */
  const SKIP = new Set(["SCRIPT", "STYLE", "CODE", "TEXTAREA", "INPUT", "KBD"]);
  const ATTRS = ["placeholder", "title", "aria-label"];
  const skipEl = (el) => !el || SKIP.has(el.tagName) || el.closest("[data-noi18n], .msg.user");

  function trNode(n) {
    if (n.__ar != null && n.data === n.__ar) return;
    const t = tr(n.data);
    if (t == null) return;
    const lead = n.data.match(/^\s*/)[0], tail = n.data.match(/\s*$/)[0];
    n.__fr = n.data;
    n.__ar = lead + t + tail;
    n.data = n.__ar;
  }
  function trAttrs(el) {
    for (const a of ATTRS) {
      const v = el.getAttribute?.(a);
      if (!v) continue;
      if (el.__ara && el.__ara[a] === v) continue;
      const t = tr(v);
      if (t == null) continue;
      el.__fra = el.__fra || {}; el.__ara = el.__ara || {};
      el.__fra[a] = v; el.__ara[a] = t;
      el.setAttribute(a, t);
    }
  }
  function translate(root) {
    if (root.nodeType === 3) { if (!skipEl(root.parentElement)) trNode(root); return; }
    if (root.nodeType !== 1 || skipEl(root)) return;
    trAttrs(root);
    root.querySelectorAll("*").forEach((el) => { if (!el.closest("[data-noi18n]")) trAttrs(el); });
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (skipEl(n.parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    let n; while ((n = w.nextNode())) trNode(n);
  }
  function restore() {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) if (n.__fr != null && n.data === n.__ar) { n.data = n.__fr; n.__ar = null; }
    document.querySelectorAll("*").forEach((el) => {
      if (!el.__fra) return;
      for (const a in el.__fra) if (el.getAttribute(a) === el.__ara[a]) el.setAttribute(a, el.__fra[a]);
      el.__fra = el.__ara = null;
    });
  }

  const mo = new MutationObserver((muts) => {
    if (window.LANG !== "ar") return;
    for (const m of muts) {
      if (m.type === "characterData") { if (!skipEl(m.target.parentElement)) trNode(m.target); }
      else if (m.type === "attributes") { if (!m.target.closest?.("[data-noi18n]")) trAttrs(m.target); }
      else m.addedNodes.forEach((n) => translate(n));
    }
  });

  function applyDir() {
    const h = document.documentElement;
    h.lang = window.LANG;
    h.dir = window.LANG === "ar" ? "rtl" : "ltr";
    const b = document.getElementById("lang-btn");
    if (b) { b.textContent = window.LANG === "ar" ? "Français" : "العربية"; b.lang = window.LANG === "ar" ? "fr" : "ar"; }
  }

  window.setLang = function (l) {
    window.LANG = l === "ar" ? "ar" : "fr";
    try { localStorage.setItem("saqiya-lang", window.LANG); } catch { /* idem */ }
    applyDir();
    if (window.LANG === "ar") translate(document.body); else restore();
    // les vues se redessinent avec les dates et formats de la nouvelle langue
    try {
      if (typeof state !== "undefined") { state.tick = 0; state.animateChart = true; }
      window.refresh && window.refresh();
      const active = document.querySelector(".view.active")?.id?.replace("view-", "");
      if (active === "analytics") window.loadAnalytics?.();
      if (active === "photos") window.loadPhotos?.();
      if (active === "history") window.loadEvents?.();
      if (active === "chat") window.loadChat?.();
      window.onLangChange?.();
    } catch { /* une vue absente n'empêche pas le changement de langue */ }
  };

  async function loadPhrases() {
    try {
      const r = await fetch("/api/i18n/ar");
      const map = await r.json();
      PHR = PHR.concat(Object.entries(map)).sort((a, b) => b[0].length - a[0].length);
    } catch { /* hors ligne : les textes agronomiques restent en français */ }
  }

  function start() {
    applyDir();
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    document.getElementById("lang-btn")?.addEventListener("click", () => window.setLang(window.LANG === "ar" ? "fr" : "ar"));
    loadPhrases().then(() => { if (window.LANG === "ar") translate(document.body); });
    if (window.LANG === "ar") translate(document.body);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
