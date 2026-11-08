/**
 * es - demo texts ("Load sample data"). Same fields and pool sizes as en.ts (see README.md).
 *
 * Peninsular Spanish, like the app's own messages ("ordenador", "quedar"): what happened today is told
 * in the pretérito perfecto ("hoy me he sentido..."). Nothing genders the writer.
 */
import type { SeedContent } from './types';

/** As chips "Mamá" / "Papá" start with a capital; inside a sentence they are common nouns ("He hablado con mamá."). */
const IN_SENTENCE: Record<string, string> = { Mamá: 'mamá', Papá: 'papá' };

/** "A", "A y B" - "e" instead of "y" before a name that starts with the sound "i" ("Marta e Irene"). */
function joinNames(names: string[]): string {
  const words = names.map((name) => IN_SENTENCE[name] ?? name);
  if (words.length <= 1) return words.join('');
  const last = words[words.length - 1];
  return `${words.slice(0, -1).join(', ')} ${/^h?i(?![aeo])/i.test(last) ? 'e' : 'y'} ${last}`;
}

const content: SeedContent = {
  titles: {
    high: ['Una mañana maravillosa', 'Un día lleno de energía', 'Un día realmente bueno', 'Por fin un buen descanso', 'Un día de pequeños logros', 'Sol y aire fresco'],
    mid: ['Un día normal', 'Un día de trabajo', 'Recados y rutina', 'Otro día que pasa', 'Un día a mi ritmo', 'Una rutina agradable'],
    // "cansancio" is the word of search example 2 (also in openers.low).
    low: ['Un día difícil', 'Un cansancio profundo', 'Hoy no ha sido fácil', 'Un día agotador', 'La cabeza pesada', 'Solo quería que acabara el día'],
  },
  openers: {
    high: [
      'Hoy me he sentido muy bien.',
      'Me he despertado con una sonrisa y el día ha seguido así.',
      'Ha sido un día lleno de buena energía.',
      'Me he sentido feliz y con el ánimo ligero.',
    ],
    mid: ['Un día normal, sin sorpresas.', 'He llevado el día a mi ritmo.', 'Nada especial, pero ha estado bien.', 'Un día de rutina, entre trabajo y recados.'],
    low: [
      'He tenido un día difícil.',
      'He sentido pesadez y cansancio durante casi todo el día.',
      'No he podido concentrarme en nada.',
      'El día ha empezado con mal pie.',
    ],
  },
  events: [
    'Reunión de trabajo',
    'Cena en familia',
    'Visita al médico',
    'Compra en el supermercado',
    'Llamada con un viejo amigo',
    'Gestiones en el banco',
    'Una conferencia interesante',
    'Día de teletrabajo',
    'Una escapada corta',
    'Limpieza de la casa',
    'Encuentro con amigos',
    'Clase en el gimnasio',
    'Noche de cine',
    'Cocinar un plato nuevo',
  ],
  sundayEvents: ['Planificar la semana', 'Reunión semanal del equipo', 'Montones de correos por responder'],
  people: ['Lucía', 'Carlos', 'Mamá', 'Papá', 'Marta', 'Sofía', 'Javier', 'Elena', 'Pablo', 'Carmen'],
  locations: ['Casa', 'Oficina', 'Parque', 'Cafetería', 'Casa de mis padres', 'Playa', 'Biblioteca'],
  tags: ['trabajo', 'familia', 'salud', 'amigos', 'deporte', 'estudios', 'descanso', 'naturaleza', 'creatividad', 'dinero'],
  sportTag: 'deporte',
  // Nouns that fit after "minutos de".
  exerciseTypes: ['caminata', 'carrera', 'entrenamiento de fuerza', 'natación', 'ciclismo', 'yoga'],
  badDay: {
    title: 'Un día terrible',
    body: 'Un día terrible. Todo ha salido mal: me he levantado tarde, me he perdido una reunión importante y he discutido con un buen amigo. Todo me superaba y no sabía por dónde empezar.',
  },
  goodDay: {
    title: 'Un día perfecto',
    body: '¡Un día perfecto! He recibido una buena noticia en el trabajo, por la noche lo hemos celebrado con toda la familia y he sentido gratitud por todo.',
  },
  sleep: (hours, low) => (low ? `Esta noche he dormido solo ${hours} horas y lo he notado.` : `He dormido ${hours} horas, bastante bien.`),
  exercise: (type, minutes, slot) => `He hecho ${minutes} minutos de ${type} ${slot === 'midday' ? 'por la mañana' : 'por la tarde'}.`,
  secondEntry: (slot) => (slot === 'midday' ? 'Unas palabras a mitad del día, entre una cosa y otra.' : 'Un breve resumen de la tarde antes de dormir.'),
  sundayNote: 'El comienzo de la semana siempre me estresa un poco: se acumulan muchas cosas en el escritorio.',
  peopleSentence: (names, met) => `${met ? 'He estado con' : 'He hablado con'} ${joinNames(names)}.`,
  note: 'Acordarme de escribir mañana sobre lo que ha ido bien.',
  // Spelled as in English: the exercise "yoga".
  sameAsEnglish: ['yoga'],
};

export default content;
