/**
 * ar - emotions messages. Keys are prefixed 'emotions.'; see shared/i18n/index.ts for the syntax.
 *
 * 'emotions.<key>.label'   - the label shown in the UI (emotion picker, badges, exports).
 *                            Arabic labels are nouns (سعادة، توتر…) so they fit every user
 *                            regardless of grammatical gender.
 * 'emotions.<key>.aliases' - comma-separated words the search parser also resolves to the
 *                            key: masculine / feminine adjectives, the accusative form with
 *                            final alif (سعيدا), colloquial synonyms. The article and attached
 *                            prepositions (ال، بال، و…) are stripped by the parser.
 */
const messages: Record<string, string> = {
  'emotions.happy.label': 'سعادة',
  'emotions.happy.aliases': 'سعيد,سعيدة,سعيدا,فرح,فرحان,فرحانة,مسرور,مسرورة,مبسوط,مبسوطة,بهجة',
  'emotions.calm.label': 'هدوء',
  'emotions.calm.aliases': 'هادئ,هادئة,هادئا,مرتاح,مرتاحة,راحة,سكينة,طمأنينة,مطمئن,مطمئنة,استرخاء',
  'emotions.sad.label': 'حزن',
  'emotions.sad.aliases': 'حزين,حزينة,حزينا,زعلان,زعلانة,مكتئب,مكتئبة,كآبة,تعيس,تعيسة',
  'emotions.angry.label': 'غضب',
  'emotions.angry.aliases': 'غاضب,غاضبة,غاضبا,عصبي,عصبية,منزعج,منزعجة,انزعاج,مستاء,مستاءة',
  'emotions.stressed.label': 'توتر',
  'emotions.stressed.aliases': 'متوتر,متوترة,متوترا,مضغوط,مضغوطة,تحت ضغط,مشدود,مشدودة',
  'emotions.excited.label': 'حماس',
  'emotions.excited.aliases': 'متحمس,متحمسة,متحمسا,حماسة,متشوق,متشوقة,شغف',
  'emotions.tired.label': 'تعب',
  'emotions.tired.aliases': 'متعب,متعبة,متعبا,تعبان,تعبانة,منهك,منهكة,إنهاك,نعسان,نعسانة,نعاس,مجهد,مجهدة',
  'emotions.satisfied.label': 'رضا',
  'emotions.satisfied.aliases': 'راض,راضي,راضية,راضيا,مكتفي,قناعة,ارتياح',
  'emotions.frustrated.label': 'إحباط',
  'emotions.frustrated.aliases': 'محبط,محبطة,محبطا,خيبة أمل,خائب,مخذول,مخذولة',
  'emotions.anxious.label': 'قلق',
  'emotions.anxious.aliases': 'قلقة,قلقا,قلقان,قلقانة,خوف,خائف,خائفة,متوجس,توجس,مضطرب,مضطربة',
  'emotions.energetic.label': 'حيوية',
  'emotions.energetic.aliases': 'نشيط,نشيطة,نشيطا,حيوي,مليء بالطاقة,مليئة بالطاقة,مفعم بالحيوية,مفعمة بالحيوية',
  'emotions.grateful.label': 'امتنان',
  'emotions.grateful.aliases': 'ممتن,ممتنة,ممتنا,شاكر,شاكرة,عرفان',
  'emotions.lonely.label': 'وحدة',
  'emotions.lonely.aliases': 'وحيد,وحيدة,وحيدا,عزلة,منعزل,منعزلة',
  'emotions.hopeful.label': 'أمل',
  'emotions.hopeful.aliases': 'متفائل,متفائلة,متفائلا,تفاؤل,مفعم بالأمل,مفعمة بالأمل',
  'emotions.bored.label': 'ملل',
  'emotions.bored.aliases': 'ضجر,ممل,زهقان,زهقانة,مللت,سأم',
  'emotions.proud.label': 'فخر',
  'emotions.proud.aliases': 'فخور,فخورة,فخورا,اعتزاز,معتز,معتزة',
  'emotions.focused.label': 'تركيز',
  'emotions.focused.aliases': 'مركز,مركزة,مركزا,منتبه,منتبهة,انتباه',
  'emotions.overwhelmed.label': 'إرهاق',
  'emotions.overwhelmed.aliases': 'مرهق,مرهقة,مرهقا,مثقل,مثقلة,غارق,غارقة,ضغط زائد',
};
export default messages;
