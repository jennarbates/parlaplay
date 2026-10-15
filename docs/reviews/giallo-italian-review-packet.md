# Chi è stato? Italian review packet

Thanks for doing this. *Chi è stato?* is a second game for adult learners at A1 to A2: they solve a small theft by questioning suspects, and the game checks the question words they build. The spec is `docs/games/it-giallo.md`. Please reply by **Wednesday, December 2**.

There are five things to check:

1. The question-word forms and rules (section A). Is each "right" form right, and each "wrong" form really a learner error?
2. The questions (section B) and every answer in case 1 (section C). Is each sentence correct, natural Italian an A1 to A2 learner could read?
3. The feedback messages (section D). English with Italian words in them; check the grammar explanations.
4. The open questions (section E). Pick an answer for each.
5. The level of each question word (section A). Look up each one in the *Profilo della lingua italiana* (Spinelli and Parizzi, 2010) and write A1, A2 or higher.

Write your comments however is easiest: inline, in the margin, or as a list of numbers.

---

## How the game talks

- The detective addresses everyone with formal *Lei*, so every question uses the third person singular: *Dov'era…?*, *Che cosa ha visto…?*
- Every question is `[preposition] [question word] [the rest]`. The learner builds the first two parts; the rest is a ready-made phrase.
- People answer in the first person, in a full sentence: *Ero in cucina.*
- The answers below use one casting: Marta is the thief, Luca and Giulia wash up together, Paolo reads alone, and Roberto is the butler. Each new game casts different people.
- The story: a birthday dinner at Villa Rosa. The cake disappears during the evening. The time slots are *tra le sette e le otto*, *tra le otto e le nove* and *tra le nove e le dieci*.

## A. Question words and the rules the game checks

| Question word | Forms the learner can pick | Example | Level (please fill in) |
|---|---|---|---|
| chi | chi | *Chi ha visto tra le otto e le nove?* | |
| che cosa | che cosa, cosa, cos', che | *Che cosa faceva tra le otto e le nove?* | |
| dove | dove, dov' | *Dov'era tra le otto e le nove?* | |
| quando | quando | *Quando è arrivata alla villa?* | |
| perché | perché | *Perché è arrivata alla villa?* | |
| come | come, com' | *Com'è arrivato alla villa?* | |
| quale | quale, quali, qual | *Qual è il Suo lavoro?*, *Quali scarpe portava?* | |
| quanto | quanto, quanta, quanti, quante, quant' | *Quante persone c'erano in cucina?* | |
| con chi | con + chi | *Con chi era tra le otto e le nove?* | |
| di chi | di + chi | *Di chi è questo ombrello?* | |
| a che ora | a + che + ora | *A che ora è arrivata alla villa?* | |
| da dove | da + dove | *Da dove viene?* | |

What the game does with each mistake:

| Right | Wrong | What happens |
|---|---|---|
| *Quante persone…?* | *Quanti persone…?* | Accepted; the correct form is shown and the mistake is noted |
| *Quali scarpe portava?* | *Quale scarpe portava?* | Accepted; correct form shown, mistake noted |
| *Qual è il Suo lavoro?* | *Qual'è il Suo lavoro?* | Accepted; correct form shown, mistake noted |
| *Dov'era…?* | *Dov' ha visto…?* (an elided form before a consonant) | Refused, with feedback |
| *Di chi è questo ombrello?* | *Chi è questo ombrello?* | Refused, with feedback |
| *A che ora è arrivata…?* | *Che ora è arrivata…?* | Refused, with feedback |
| *Da dove viene?* | *Dove viene?* | Refused, with feedback |

These are accepted as correct, with no comment:

- *che cosa*, *cosa* and *che* in every question that takes one.
- *dove era*, *come è*, *cosa è* written out without elision.
- *quando* and *a che ora* in the arrival question. They get different answers (*nel pomeriggio*, *alle quattro*).

## B. The questions

The phrase after the question word changes with the person's gender (*arrivato*, *arrivata*). The slot in brackets can be any of the three times.

- Dov'era tra le otto e le nove?
- Con chi era tra le otto e le nove?
- Che cosa faceva tra le otto e le nove?
- Chi ha visto tra le otto e le nove?
- Che cosa ha visto tra le otto e le nove?
- Quante persone c'erano in cucina tra le otto e le nove?
- Quando è sparita la torta?
- Quando è arrivato alla villa?
- Quando è arrivata alla villa?
- A che ora è arrivato alla villa?
- A che ora è arrivata alla villa?
- Com'è arrivato alla villa?
- Com'è arrivata alla villa?
- Perché è arrivato alla villa?
- Perché è arrivata alla villa?
- Con chi è arrivato alla villa?
- Con chi è arrivata alla villa?
- Da dove viene?
- Qual è il Suo lavoro?
- Quanti anni ha?
- Quali scarpe portava?
- Quanto tempo è rimasto in giardino?
- Quanto tempo è rimasta in giardino?
- Quanta torta ha mangiato?
- Di chi è questo ombrello?
- Di chi sono queste chiavi?

## C. Every answer in case 1

Rendered with the cake hidden in the library and stolen *tra le otto e le nove*. "Who" is the person's part in the story (`r.culprit` is the thief, `r.witness` the butler or housekeeper) or their job (`j.cuoco` the cook). `*` means anyone without their own answer. A slot of *crime* means the time of the theft; *other* means the other two times, when everyone was at dinner. Answers marked as a lie in the game: `r.culprit` on `f.at.slot` with `q.dove`, and on `f.doing.slot`.

| Who | Frame | Slot | Question word | Answer (m) | Answer (f) |
|---|---|---|---|---|---|
| `r.culprit` | `f.at.slot` | crime | `q.dove` | Ero in sala da pranzo. | (same) |
| `r.culprit` | `f.at.slot` | crime | `q.con_chi` | Ero da solo. | Ero da sola. |
| `r.culprit` | `f.doing.slot` | crime | `q.cosa` | Bevevo un caffè in sala da pranzo. | (same) |
| `r.culprit` | `f.saw.slot` | crime | `q.chi` | Non ho visto nessuno. | (same) |
| `r.culprit` | `f.saw.slot` | crime | `q.cosa` | Niente di strano. | (same) |
| `r.culprit` | `f.people.cucina.slot` | crime | `q.quanto` | Non lo so: non ero in cucina. | (same) |
| `r.pairA` | `f.at.slot` | crime | `q.dove` | Ero in cucina. | (same) |
| `r.pairA` | `f.at.slot` | crime | `q.con_chi` | Ero con Giulia. | (same) |
| `r.pairA` | `f.doing.slot` | crime | `q.cosa` | Lavavo i piatti con Giulia. | (same) |
| `r.pairA` | `f.saw.slot` | crime | `q.chi` | Ho visto solo Giulia. | (same) |
| `r.pairA` | `f.saw.slot` | crime | `q.cosa` | Niente di strano: lavavo i piatti. | (same) |
| `r.pairA` | `f.people.cucina.slot` | crime | `q.quanto` | Due: io e Giulia. | (same) |
| `r.pairB` | `f.at.slot` | crime | `q.dove` | Ero in cucina. | (same) |
| `r.pairB` | `f.at.slot` | crime | `q.con_chi` | Ero con Luca. | (same) |
| `r.pairB` | `f.doing.slot` | crime | `q.cosa` | Asciugavo i piatti. Luca li lavava. | (same) |
| `r.pairB` | `f.saw.slot` | crime | `q.chi` | Ho visto solo Luca. | (same) |
| `r.pairB` | `f.saw.slot` | crime | `q.cosa` | Niente di strano. | (same) |
| `r.pairB` | `f.people.cucina.slot` | crime | `q.quanto` | Due: io e Luca. | (same) |
| `r.seen` | `f.at.slot` | crime | `q.dove` | Ero in sala da pranzo. | (same) |
| `r.seen` | `f.at.slot` | crime | `q.con_chi` | Ero da solo. Non è entrato nessuno. | Ero da sola. Non è entrato nessuno. |
| `r.seen` | `f.doing.slot` | crime | `q.cosa` | Leggevo il giornale. | (same) |
| `r.seen` | `f.saw.slot` | crime | `q.chi` | Non ho visto nessuno. | (same) |
| `r.seen` | `f.saw.slot` | crime | `q.cosa` | Niente di strano. | (same) |
| `r.seen` | `f.people.cucina.slot` | crime | `q.quanto` | Non lo so: non ero in cucina. | (same) |
| `r.witness` | `f.at.slot` | crime | `q.dove` | Ero in giro per la villa. | (same) |
| `r.witness` | `f.at.slot` | crime | `q.con_chi` | Ero da solo. | Ero da sola. |
| `r.witness` | `f.doing.slot` | crime | `q.cosa` | Controllavo le porte e le finestre. | (same) |
| `r.witness` | `f.saw.slot` | crime | `q.chi` | Ho visto Paolo in sala da pranzo, dalla porta. Leggeva il giornale. | (same) |
| `r.witness` | `f.saw.slot` | crime | `q.cosa` | Ho visto delle briciole di torta in biblioteca. | (same) |
| `r.witness` | `f.people.cucina.slot` | crime | `q.quanto` | Due, credo. Ho sentito due voci. | (same) |
| `r.witness` | `f.stolen.torta` |  | `q.quando` | È sparita tra le otto e le nove. | (same) |
| `*` | `f.stolen.torta` |  | `q.quando` | Non lo so. Chieda a Roberto. | (same) |
| `r.witness` | `f.at.slot` | other | `q.dove` | Ero in sala da pranzo: servivo la cena. | (same) |
| `r.witness` | `f.at.slot` | other | `q.con_chi` | Ero con tutti gli ospiti. | (same) |
| `r.witness` | `f.doing.slot` | other | `q.cosa` | Servivo la cena. | (same) |
| `*` | `f.at.slot` | other | `q.dove` | Ero in sala da pranzo, a cena. | (same) |
| `*` | `f.at.slot` | other | `q.con_chi` | Ero con tutti gli altri. | (same) |
| `*` | `f.doing.slot` | other | `q.cosa` | Cenavo con gli altri. | (same) |
| `*` | `f.saw.slot` | other | `q.chi` | Ho visto tutti a tavola. | (same) |
| `*` | `f.saw.slot` | other | `q.cosa` | Niente di strano. | (same) |
| `*` | `f.people.cucina.slot` | other | `q.quanto` | Nessuna: eravamo tutti a cena. | (same) |
| `r.witness` | `f.job` |  | `q.quale` | Sono il maggiordomo. | Sono la governante. |
| `*` | `f.job` |  | `q.quale` | Sono il cuoco. | Sono la cuoca. |
| `r.witness` | `f.arrive` |  | `q.quando` | Io abito qui, alla villa. | (same) |
| `r.witness` | `f.arrive` |  | `q.a_che_ora` | Io abito qui, alla villa. | (same) |
| `r.witness` | `f.arrive` |  | `q.come` | Io abito qui, alla villa. | (same) |
| `r.witness` | `f.arrive` |  | `q.perche` | Io abito qui, alla villa. | (same) |
| `r.witness` | `f.arrive` |  | `q.con_chi` | Io abito qui, alla villa. | (same) |
| `r.witness` | `f.from` |  | `q.da_dove` | Vengo da Lucca. | (same) |
| `r.witness` | `f.age` |  | `q.quanto` | Ho sessantatré anni. | (same) |
| `r.witness` | `f.shoes` |  | `q.quale` | Portavo le scarpe nere, come sempre. | (same) |
| `r.witness` | `f.time.garden` |  | `q.quanto` | Oggi non sono andato in giardino. | Oggi non sono andata in giardino. |
| `j.cuoco` | `f.arrive` |  | `q.quando` | Sono arrivato nel pomeriggio. | Sono arrivata nel pomeriggio. |
| `j.cuoco` | `f.arrive` |  | `q.a_che_ora` | Sono arrivato alle quattro. | Sono arrivata alle quattro. |
| `j.cuoco` | `f.arrive` |  | `q.come` | Sono arrivato in autobus. | Sono arrivata in autobus. |
| `j.cuoco` | `f.arrive` |  | `q.perche` | Per preparare la cena della festa. | (same) |
| `j.cuoco` | `f.arrive` |  | `q.con_chi` | Sono arrivato da solo. | Sono arrivata da sola. |
| `j.cuoco` | `f.from` |  | `q.da_dove` | Vengo da Napoli. | (same) |
| `j.cuoco` | `f.age` |  | `q.quanto` | Ho quarantacinque anni. | (same) |
| `j.cuoco` | `f.shoes` |  | `q.quale` | Portavo le scarpe bianche da lavoro. | (same) |
| `j.cuoco` | `f.time.garden` |  | `q.quanto` | Cinque minuti, prima di cena. Ho preso il basilico. | (same) |
| `j.giardiniere` | `f.arrive` |  | `q.quando` | Sono arrivato stamattina. | Sono arrivata stamattina. |
| `j.giardiniere` | `f.arrive` |  | `q.a_che_ora` | Sono arrivato alle sette di mattina. | Sono arrivata alle sette di mattina. |
| `j.giardiniere` | `f.arrive` |  | `q.come` | Sono arrivato in bicicletta. | Sono arrivata in bicicletta. |
| `j.giardiniere` | `f.arrive` |  | `q.perche` | Per lavorare in giardino, e poi per la festa. | (same) |
| `j.giardiniere` | `f.arrive` |  | `q.con_chi` | Sono arrivato da solo. | Sono arrivata da sola. |
| `j.giardiniere` | `f.from` |  | `q.da_dove` | Vengo da Siena. | (same) |
| `j.giardiniere` | `f.age` |  | `q.quanto` | Ho cinquantotto anni. | (same) |
| `j.giardiniere` | `f.shoes` |  | `q.quale` | Portavo gli stivali. | (same) |
| `j.giardiniere` | `f.time.garden` |  | `q.quanto` | Tutto il giorno: è il mio lavoro! | (same) |
| `j.nipote` | `f.arrive` |  | `q.quando` | Sono arrivato ieri sera. | Sono arrivata ieri sera. |
| `j.nipote` | `f.arrive` |  | `q.a_che_ora` | Sono arrivato alle nove di sera, ieri. | Sono arrivata alle nove di sera, ieri. |
| `j.nipote` | `f.arrive` |  | `q.come` | Sono arrivato in treno. | Sono arrivata in treno. |
| `j.nipote` | `f.arrive` |  | `q.perche` | Per il compleanno di mia zia. | (same) |
| `j.nipote` | `f.arrive` |  | `q.con_chi` | Sono arrivato da solo. | Sono arrivata da sola. |
| `j.nipote` | `f.from` |  | `q.da_dove` | Vengo da Milano. | (same) |
| `j.nipote` | `f.age` |  | `q.quanto` | Ho diciannove anni. | (same) |
| `j.nipote` | `f.shoes` |  | `q.quale` | Portavo le scarpe da ginnastica. | (same) |
| `j.nipote` | `f.time.garden` |  | `q.quanto` | Dieci minuti, prima di cena. Ho fatto una telefonata. | (same) |
| `j.vicino` | `f.arrive` |  | `q.quando` | Sono arrivato poco prima di cena. | Sono arrivata poco prima di cena. |
| `j.vicino` | `f.arrive` |  | `q.a_che_ora` | Sono arrivato alle sei e mezza. | Sono arrivata alle sei e mezza. |
| `j.vicino` | `f.arrive` |  | `q.come` | Sono arrivato a piedi. Abito qui accanto. | Sono arrivata a piedi. Abito qui accanto. |
| `j.vicino` | `f.arrive` |  | `q.perche` | La signora Rosa mi ha invitato alla festa. | La signora Rosa mi ha invitata alla festa. |
| `j.vicino` | `f.arrive` |  | `q.con_chi` | Sono arrivato con il mio cane. | Sono arrivata con il mio cane. |
| `j.vicino` | `f.from` |  | `q.da_dove` | Vengo da Firenze. | (same) |
| `j.vicino` | `f.age` |  | `q.quanto` | Ho sessantasette anni. | (same) |
| `j.vicino` | `f.shoes` |  | `q.quale` | Portavo le scarpe nere. | (same) |
| `j.vicino` | `f.time.garden` |  | `q.quanto` | Mezz'ora, prima di cena. Ho portato fuori il cane. | (same) |
| `*` | `f.cake` |  | `q.quanto` | Niente! La torta è sparita prima del dolce. | (same) |
| `r.witness` | `f.owner.umbrella` |  | `q.di_chi` | È di Giulia. | (same) |
| `r.pairB` | `f.owner.umbrella` |  | `q.di_chi` | È mio. L'ho lasciato all'ingresso. | (same) |
| `r.witness` | `f.owner.keys` |  | `q.di_chi` | Sono di Paolo. | (same) |
| `r.seen` | `f.owner.keys` |  | `q.di_chi` | Sono mie! Le cercavo. | (same) |

Default answer: Non lo so.

## D. Feedback messages

| When | Message |
|---|---|
| *Quanti persone* | *Persone* is feminine plural, so *quante*. |
| *Quale scarpe* | *Scarpe* is plural, so *quali*. |
| *Qual'è* | *Qual è* never takes an apostrophe. |
| *Dov' ha* | Use *dove* here: *dov'* only goes before a vowel. |
| *Chi è questo ombrello?* | To ask whose, Italian says *di chi*. |
| *Che ora è arrivata?* | To ask what time, Italian says *a che ora*. |
| *Dove viene?* | To ask where from, Italian says *da dove*. |
| Any question that makes no sense | *Non capisco la domanda.* |

## E. Open questions

1. **Cos'ha.** The game treats *ha* as starting with a consonant, so *Cos'ha visto?* is refused and the learner is told to write *cosa ha*. Should *cos'ha* be accepted?
2. **Perché with arrivare.** One phrase, *è arrivato/arrivata alla villa*, is shared by *quando*, *a che ora*, *come*, *perché* and *con chi*. Is *Perché è arrivata alla villa?* natural enough, or should *perché* get its own phrase (*Perché è venuta alla villa?*)?
3. **Dove viene.** Is *Dove viene?* clearly wrong for "where are you from", or common enough in speech that refusing it would mark real Italian wrong?
4. **Quale scarpe.** Is this a slip worth noting (as the game does now), or a stronger error?
5. **Che.** *Che faceva tra le otto e le nove?* is accepted as a variant of *Che cosa faceva…?*. Is it fine at A1, or too informal to model?
6. **Imperfect.** The answers use the imperfect (*ero*, *lavavo*, *leggeva*) and the passato prossimo (*sono arrivata*, *ho visto*). Is that reasonable for an A1 to A2 learner who only has to read them?
