/**
 * hi - emotions messages. Keys are prefixed 'emotions.'; see shared/i18n/index.ts for the syntax.
 *
 * 'emotions.<key>.label'   - the label shown in the UI (emotion picker, badges, exports).
 * 'emotions.<key>.aliases' - comma-separated words the search parser also resolves to the
 *                            key (synonyms, other forms, nouns). Lowercase; matching is
 *                            case-insensitive. Keep the list in this language's own words.
 *
 * Hindi adjectives such as थका हुआ / अकेला inflect for gender and number: the labels use the
 * common default form, the aliases list the feminine and plural forms (थकी हुई, अकेली ...)
 * and the related nouns (थकान, अकेलापन ...) so the search understands every variant.
 * Words that are also common first names (आनंद, शांति, संतोष, आशा, गौरव, उमंग) are left out on purpose.
 */
const messages: Record<string, string> = {
  'emotions.happy.label': 'खुश',
  'emotions.happy.aliases': 'ख़ुश,खुशी,ख़ुशी,प्रसन्न,प्रसन्नता,आनंदित,मगन,खुशमिज़ाज',
  'emotions.calm.label': 'शांत',
  'emotions.calm.aliases': 'शान्त,सुकून,सुकून में,चैन,चैन से,निश्चिंत,तनावमुक्त,रिलैक्स',
  'emotions.sad.label': 'उदास',
  'emotions.sad.aliases': 'उदासी,दुखी,दुःखी,दुख,ग़मगीन,गमगीन,मायूस,निराश,निराशा,उदास मन',
  'emotions.angry.label': 'नाराज़',
  'emotions.angry.aliases': 'नाराज,नाराज़गी,गुस्सा,ग़ुस्सा,गुस्से में,ग़ुस्से में,क्रोध,क्रोधित,चिढ़,चिढ़ा हुआ,चिढ़ी हुई,खफ़ा,खफा',
  'emotions.stressed.label': 'तनावग्रस्त',
  'emotions.stressed.aliases': 'तनाव में,टेंशन,टेंशन में,दबाव में,स्ट्रेस,स्ट्रेस में,परेशान',
  'emotions.excited.label': 'उत्साहित',
  'emotions.excited.aliases': 'उत्साह,रोमांचित,रोमांच,जोश,जोश में',
  'emotions.tired.label': 'थका हुआ',
  'emotions.tired.aliases': 'थका,थकी,थकी हुई,थके,थके हुए,थकान,थकावट,थका-माँदा,थकी-माँदी,निढाल,उनींदा,उनींदी,नींद में',
  'emotions.satisfied.label': 'संतुष्ट',
  'emotions.satisfied.aliases': 'संतुष्टि,तृप्त,तसल्ली',
  'emotions.frustrated.label': 'कुंठित',
  'emotions.frustrated.aliases': 'कुंठा,झुंझलाहट,झुंझलाया,झुंझलाई,झुंझलाया हुआ,झुंझलाई हुई,खीज,खीझ,हताश,हताशा',
  'emotions.anxious.label': 'चिंतित',
  'emotions.anxious.aliases': 'चिंता,फ़िक्र,फिक्र,बेचैन,बेचैनी,घबराहट,घबराया,घबराई,घबराया हुआ,घबराई हुई,व्याकुल,डरा हुआ,डरी हुई',
  'emotions.energetic.label': 'ऊर्जावान',
  'emotions.energetic.aliases': 'ऊर्जा से भरपूर,जोशीला,जोशीली,स्फूर्त,स्फूर्ति,फुर्तीला,फुर्तीली,तरोताज़ा,तरोताजा',
  'emotions.grateful.label': 'आभारी',
  'emotions.grateful.aliases': 'कृतज्ञ,कृतज्ञता,आभार,शुक्रगुज़ार,शुक्रगुजार,एहसानमंद',
  'emotions.lonely.label': 'अकेला',
  'emotions.lonely.aliases': 'अकेली,अकेले,अकेलापन,तन्हा,तनहा,तन्हाई,एकाकी,एकाकीपन',
  'emotions.hopeful.label': 'आशावान',
  'emotions.hopeful.aliases': 'उम्मीद,उम्मीद से भरा,उम्मीद से भरी,आशावादी,आशान्वित,आशावाद',
  'emotions.bored.label': 'ऊबा हुआ',
  'emotions.bored.aliases': 'ऊबा,ऊबी,ऊबी हुई,ऊबे हुए,ऊब,बोर,बोरियत,उकताया,उकताई,उकताहट',
  'emotions.proud.label': 'गर्वित',
  'emotions.proud.aliases': 'गर्व,गौरवान्वित,फ़ख़्र,फख्र',
  'emotions.focused.label': 'एकाग्र',
  'emotions.focused.aliases': 'एकाग्रता,एकाग्रचित्त,केंद्रित,ध्यान केंद्रित,फ़ोकस,फोकस',
  'emotions.overwhelmed.label': 'अभिभूत',
  'emotions.overwhelmed.aliases': 'बोझिल,बोझ तले,बोझ से दबा,बोझ से दबी,दबा हुआ,दबी हुई,बेहाल,हैरान-परेशान',
};
export default messages;
