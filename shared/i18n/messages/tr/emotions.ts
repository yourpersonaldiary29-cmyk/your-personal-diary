/**
 * tr - emotions messages. Keys are prefixed 'emotions.'; see shared/i18n/index.ts for the syntax.
 *
 * 'emotions.<key>.label'   - the label shown in the UI (emotion picker, badges, exports).
 * 'emotions.<key>.aliases' - comma-separated words the search parser also resolves to the
 *                            key: synonyms, nouns and the most common suffixed forms
 *                            ("yorgundum", "mutluydum") - Turkish glues the copula and
 *                            person endings to the adjective and the parser matches whole
 *                            words only. Lowercase (Turkish i / ı).
 */
const messages: Record<string, string> = {
  'emotions.happy.label': 'Mutlu',
  'emotions.happy.aliases': 'mutluluk,mutluydum,mutluyum,sevinçli,sevinç,neşeli,keyifli',
  'emotions.calm.label': 'Sakin',
  'emotions.calm.aliases': 'sakindim,sakinlik,huzurlu,huzurluydum,huzur,rahat,rahattım,dingin,sükûnet',
  'emotions.sad.label': 'Üzgün',
  'emotions.sad.aliases': 'üzgündüm,üzüntü,mutsuz,mutsuzdum,hüzünlü,hüzün,kederli,keder,moralsiz',
  'emotions.angry.label': 'Kızgın',
  'emotions.angry.aliases': 'kızgındım,kızgınlık,öfkeli,öfkeliydim,öfke,sinirli,sinirliydim,sinir,hiddetli',
  'emotions.stressed.label': 'Stresli',
  'emotions.stressed.aliases': 'stresliydim,stresliyim,gergin,gergindim,gerginlik,baskı altında,strese girdim',
  'emotions.excited.label': 'Heyecanlı',
  'emotions.excited.aliases': 'heyecanlıydım,heyecan,heyecanlandım,coşkulu,coşku,hevesli',
  'emotions.tired.label': 'Yorgun',
  'emotions.tired.aliases': 'yorgundum,yorgunum,yorgunluk,yoruldum,bitkin,bitkindim,tükenmiş,halsiz,uykulu',
  'emotions.satisfied.label': 'Memnun',
  'emotions.satisfied.aliases': 'memnundum,memnuniyet,tatmin olmuş,tatmin,hoşnut,doyum',
  'emotions.frustrated.label': 'Hüsrana uğramış',
  'emotions.frustrated.aliases': 'hüsran,hayal kırıklığı,hayal kırıklığına uğramış,hayal kırıklığına uğradım,engellenmiş,bıkkın',
  'emotions.anxious.label': 'Kaygılı',
  'emotions.anxious.aliases': 'kaygılıydım,kaygı,endişeli,endişeliydim,endişe,tedirgin,huzursuz,korku,anksiyete',
  'emotions.energetic.label': 'Enerjik',
  'emotions.energetic.aliases': 'enerjiktim,enerji dolu,dinç,zinde,canlı,hareketli',
  'emotions.grateful.label': 'Minnettar',
  'emotions.grateful.aliases': 'minnettardım,minnet,şükran,müteşekkir,şükür',
  'emotions.lonely.label': 'Yalnız',
  'emotions.lonely.aliases': 'yalnızdım,yalnızlık,kimsesiz,yapayalnız',
  'emotions.hopeful.label': 'Umutlu',
  'emotions.hopeful.aliases': 'umutluydum,umut,umut dolu,iyimser,iyimserlik',
  'emotions.bored.label': 'Sıkılmış',
  'emotions.bored.aliases': 'sıkıldım,sıkılmıştım,can sıkıntısı,canım sıkıldı,sıkıcı',
  'emotions.proud.label': 'Gururlu',
  'emotions.proud.aliases': 'gururluydum,gurur,gurur duydum,iftihar',
  'emotions.focused.label': 'Odaklanmış',
  'emotions.focused.aliases': 'odaklı,odak,odaklandım,konsantre,konsantrasyon',
  'emotions.overwhelmed.label': 'Bunalmış',
  'emotions.overwhelmed.aliases': 'bunaldım,bunalmıştım,bunalım,bunaltı,boğulmuş,altında ezilmiş',
};
export default messages;
