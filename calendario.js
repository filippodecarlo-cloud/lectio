/* Calendario liturgico perpetuo (rito romano, calendario italiano) e Vangelo del giorno dal Lezionario.
 *
 * giornoLiturgico(anno, mese, giorno) -> { nome, vangelo, grado }
 *
 * Il calendario si calcola: Pasqua (computo gregoriano) e da lì Ceneri, Quaresima, Settimana Santa,
 * Ascensione e Corpus Domini (in Italia di domenica), Pentecoste; Avvento dalla quarta domenica prima
 * di Natale; Tempo Ordinario contato in avanti dal Battesimo del Signore e all'indietro da Cristo Re.
 * Ciclo domenicale A/B/C dall'anno liturgico. Le feste dei santi seguono le regole di precedenza
 * (grado più basso = più importante, come nella Tabella dei giorni liturgici).
 */
(function (root) {
  'use strict';

  /* ------------------------------------------------------------------ Lezionario: Vangeli */

  const ADV_DOM = {
    A: ['Mt 24,37-44', 'Mt 3,1-12', 'Mt 11,2-11', 'Mt 1,18-24'],
    B: ['Mc 13,33-37', 'Mc 1,1-8', 'Gv 1,6-8.19-28', 'Lc 1,26-38'],
    C: ['Lc 21,25-28.34-36', 'Lc 3,1-6', 'Lc 3,10-18', 'Lc 1,39-45'],
  };
  // ferie di Avvento fino al 16 dicembre: [settimana][lunedì..sabato]
  const ADV_FER = [
    ['Mt 8,5-11', 'Lc 10,21-24', 'Mt 15,29-37', 'Mt 7,21.24-27', 'Mt 9,27-31', 'Mt 9,35-10,1.5a.6-8'],
    ['Lc 5,17-26', 'Mt 18,12-14', 'Mt 11,28-30', 'Mt 11,11-15', 'Mt 11,16-19', 'Mt 17,10-13'],
    ['Mt 21,23-27', 'Mt 21,28-32', 'Lc 7,19-23', 'Lc 7,24-30', 'Gv 5,33-36', null],
  ];
  const ADV_DIC = {
    17: 'Mt 1,1-17', 18: 'Mt 1,18-24', 19: 'Lc 1,5-25', 20: 'Lc 1,26-38',
    21: 'Lc 1,39-45', 22: 'Lc 1,46-55', 23: 'Lc 1,57-66', 24: 'Lc 1,67-79',
  };
  const NATALE = {
    '12-25': ['Natale del Signore', 'Gv 1,1-18'],
    '12-26': ['Santo Stefano, primo martire', 'Mt 10,17-22'],
    '12-27': ['San Giovanni, apostolo ed evangelista', 'Gv 20,2-8'],
    '12-28': ['Santi Innocenti, martiri', 'Mt 2,13-18'],
    '12-29': ['V giorno fra l\'ottava di Natale', 'Lc 2,22-35'],
    '12-30': ['VI giorno fra l\'ottava di Natale', 'Lc 2,36-40'],
    '12-31': ['VII giorno fra l\'ottava di Natale', 'Gv 1,1-18'],
    '01-01': ['Maria Santissima Madre di Dio', 'Lc 2,16-21'],
    '01-02': ['Feria del tempo di Natale', 'Gv 1,19-28'],
    '01-03': ['Feria del tempo di Natale', 'Gv 1,29-34'],
    '01-04': ['Feria del tempo di Natale', 'Gv 1,35-42'],
    '01-05': ['Feria del tempo di Natale', 'Gv 1,43-51'],
    '01-06': ['Epifania del Signore', 'Mt 2,1-12'],
    '01-07': ['Feria del tempo di Natale', 'Mt 4,12-17.23-25'],
    '01-08': ['Feria del tempo di Natale', 'Mc 6,34-44'],
    '01-09': ['Feria del tempo di Natale', 'Mc 6,45-52'],
    '01-10': ['Feria del tempo di Natale', 'Lc 4,14-22a'],
    '01-11': ['Feria del tempo di Natale', 'Lc 5,12-16'],
    '01-12': ['Feria del tempo di Natale', 'Gv 3,22-30'],
  };
  const SACRA_FAMIGLIA = { A: 'Mt 2,13-15.19-23', B: 'Lc 2,22-40', C: 'Lc 2,41-52' };
  const BATTESIMO = { A: 'Mt 3,13-17', B: 'Mc 1,7-11', C: 'Lc 3,15-16.21-22' };

  const QUA_DOM = {
    A: ['Mt 4,1-11', 'Mt 17,1-9', 'Gv 4,5-42', 'Gv 9,1-41', 'Gv 11,1-45'],
    B: ['Mc 1,12-15', 'Mc 9,2-10', 'Gv 2,13-25', 'Gv 3,14-21', 'Gv 12,20-33'],
    C: ['Lc 4,1-13', 'Lc 9,28b-36', 'Lc 13,1-9', 'Lc 15,1-3.11-32', 'Gv 8,1-11'],
  };
  const CENERI = ['Mt 6,1-6.16-18', 'Lc 9,22-25', 'Mt 9,14-15', 'Lc 5,27-32'];   // mercoledì, giovedì, venerdì, sabato
  const QUA_FER = [
    ['Mt 25,31-46', 'Mt 6,7-15', 'Lc 11,29-32', 'Mt 7,7-12', 'Mt 5,20-26', 'Mt 5,43-48'],
    ['Lc 6,36-38', 'Mt 23,1-12', 'Mt 20,17-28', 'Lc 16,19-31', 'Mt 21,33-43.45-46', 'Lc 15,1-3.11-32'],
    ['Lc 4,24-30', 'Mt 18,21-35', 'Mt 5,17-19', 'Lc 11,14-23', 'Mc 12,28b-34', 'Lc 18,9-14'],
    ['Gv 4,43-54', 'Gv 5,1-16', 'Gv 5,17-30', 'Gv 5,31-47', 'Gv 7,1-2.10.25-30', 'Gv 7,40-53'],
    ['Gv 8,1-11', 'Gv 8,21-30', 'Gv 8,31-42', 'Gv 8,51-59', 'Gv 10,31-42', 'Gv 11,45-56'],
  ];
  const PALME = { A: 'Mt 26,14-27,66', B: 'Mc 14,1-15,47', C: 'Lc 22,14-23,56' };
  const SETTIMANA_SANTA = ['Gv 12,1-11', 'Gv 13,21-33.36-38', 'Mt 26,14-25'];
  const VEGLIA = { A: 'Mt 28,1-10', B: 'Mc 16,1-7', C: 'Lc 24,1-12' };

  const OTTAVA_PASQUA = ['Mt 28,8-15', 'Gv 20,11-18', 'Lc 24,13-35', 'Lc 24,35-48', 'Gv 21,1-14', 'Mc 16,9-15'];
  const PAS_DOM = {   // II..VI domenica di Pasqua
    A: ['Gv 20,19-31', 'Lc 24,13-35', 'Gv 10,1-10', 'Gv 14,1-12', 'Gv 14,15-21'],
    B: ['Gv 20,19-31', 'Lc 24,35-48', 'Gv 10,11-18', 'Gv 15,1-8', 'Gv 15,9-17'],
    C: ['Gv 20,19-31', 'Gv 21,1-19', 'Gv 10,27-30', 'Gv 13,31-33a.34-35', 'Gv 14,23-29'],
  };
  const PAS_FER = [   // settimane II..VII
    ['Gv 3,1-8', 'Gv 3,7b-15', 'Gv 3,16-21', 'Gv 3,31-36', 'Gv 6,1-15', 'Gv 6,16-21'],
    ['Gv 6,22-29', 'Gv 6,30-35', 'Gv 6,35-40', 'Gv 6,44-51', 'Gv 6,52-59', 'Gv 6,60-69'],
    ['Gv 10,1-10', 'Gv 10,22-30', 'Gv 12,44-50', 'Gv 13,16-20', 'Gv 14,1-6', 'Gv 14,7-14'],
    ['Gv 14,21-26', 'Gv 14,27-31a', 'Gv 15,1-8', 'Gv 15,9-11', 'Gv 15,12-17', 'Gv 15,18-21'],
    ['Gv 15,26-16,4a', 'Gv 16,5-11', 'Gv 16,12-15', 'Gv 16,16-20', 'Gv 16,20-23a', 'Gv 16,23b-28'],
    ['Gv 16,29-33', 'Gv 17,1-11a', 'Gv 17,11b-19', 'Gv 17,20-26', 'Gv 21,15-19', 'Gv 21,20-25'],
  ];
  const ASCENSIONE = { A: 'Mt 28,16-20', B: 'Mc 16,15-20', C: 'Lc 24,46-53' };
  const PENTECOSTE = { A: 'Gv 20,19-23', B: 'Gv 15,26-27;16,12-15', C: 'Gv 14,15-16.23b-26' };
  const TRINITA = { A: 'Gv 3,16-18', B: 'Mt 28,16-20', C: 'Gv 16,12-15' };
  const CORPUS = { A: 'Gv 6,51-58', B: 'Mc 14,12-16.22-26', C: 'Lc 9,11b-17' };
  const SACRO_CUORE = { A: 'Mt 11,25-30', B: 'Gv 19,31-37', C: 'Lc 15,3-7' };
  const CRISTO_RE = { A: 'Mt 25,31-46', B: 'Gv 18,33b-37', C: 'Lc 23,35-43' };

  // domeniche del Tempo Ordinario II..XXXIII
  const TO_DOM = {
    A: ['Gv 1,29-34', 'Mt 4,12-23', 'Mt 5,1-12a', 'Mt 5,13-16', 'Mt 5,17-37', 'Mt 5,38-48', 'Mt 6,24-34', 'Mt 7,21-27',
      'Mt 9,9-13', 'Mt 9,36-10,8', 'Mt 10,26-33', 'Mt 10,37-42', 'Mt 11,25-30', 'Mt 13,1-23', 'Mt 13,24-43', 'Mt 13,44-52',
      'Mt 14,13-21', 'Mt 14,22-33', 'Mt 15,21-28', 'Mt 16,13-20', 'Mt 16,21-27', 'Mt 18,15-20', 'Mt 18,21-35', 'Mt 20,1-16a',
      'Mt 21,28-32', 'Mt 21,33-43', 'Mt 22,1-14', 'Mt 22,15-21', 'Mt 22,34-40', 'Mt 23,1-12', 'Mt 25,1-13', 'Mt 25,14-30'],
    B: ['Gv 1,35-42', 'Mc 1,14-20', 'Mc 1,21-28', 'Mc 1,29-39', 'Mc 1,40-45', 'Mc 2,1-12', 'Mc 2,18-22', 'Mc 2,23-3,6',
      'Mc 3,20-35', 'Mc 4,26-34', 'Mc 4,35-41', 'Mc 5,21-43', 'Mc 6,1-6', 'Mc 6,7-13', 'Mc 6,30-34', 'Gv 6,1-15',
      'Gv 6,24-35', 'Gv 6,41-51', 'Gv 6,51-58', 'Gv 6,60-69', 'Mc 7,1-8.14-15.21-23', 'Mc 7,31-37', 'Mc 8,27-35', 'Mc 9,30-37',
      'Mc 9,38-43.45.47-48', 'Mc 10,2-16', 'Mc 10,17-30', 'Mc 10,35-45', 'Mc 10,46-52', 'Mc 12,28b-34', 'Mc 12,38-44', 'Mc 13,24-32'],
    C: ['Gv 2,1-11', 'Lc 1,1-4;4,14-21', 'Lc 4,21-30', 'Lc 5,1-11', 'Lc 6,17.20-26', 'Lc 6,27-38', 'Lc 6,39-45', 'Lc 7,1-10',
      'Lc 7,11-17', 'Lc 7,36-8,3', 'Lc 9,18-24', 'Lc 9,51-62', 'Lc 10,1-12.17-20', 'Lc 10,25-37', 'Lc 10,38-42', 'Lc 11,1-13',
      'Lc 12,13-21', 'Lc 12,32-48', 'Lc 12,49-53', 'Lc 13,22-30', 'Lc 14,1.7-14', 'Lc 14,25-33', 'Lc 15,1-32', 'Lc 16,1-13',
      'Lc 16,19-31', 'Lc 17,5-10', 'Lc 17,11-19', 'Lc 18,1-8', 'Lc 18,9-14', 'Lc 19,1-10', 'Lc 20,27-38', 'Lc 21,5-19'],
  };
  // ferie del Tempo Ordinario, settimane I..XXXIV, lunedì..sabato (uguali negli anni I e II)
  const TO_FER = [
    ['Mc 1,14-20', 'Mc 1,21b-28', 'Mc 1,29-39', 'Mc 1,40-45', 'Mc 2,1-12', 'Mc 2,13-17'],
    ['Mc 2,18-22', 'Mc 2,23-28', 'Mc 3,1-6', 'Mc 3,7-12', 'Mc 3,13-19', 'Mc 3,20-21'],
    ['Mc 3,22-30', 'Mc 3,31-35', 'Mc 4,1-20', 'Mc 4,21-25', 'Mc 4,26-34', 'Mc 4,35-41'],
    ['Mc 5,1-20', 'Mc 5,21-43', 'Mc 6,1-6', 'Mc 6,7-13', 'Mc 6,14-29', 'Mc 6,30-34'],
    ['Mc 6,53-56', 'Mc 7,1-13', 'Mc 7,14-23', 'Mc 7,24-30', 'Mc 7,31-37', 'Mc 8,1-10'],
    ['Mc 8,11-13', 'Mc 8,14-21', 'Mc 8,22-26', 'Mc 8,27-33', 'Mc 8,34-9,1', 'Mc 9,2-13'],
    ['Mc 9,14-29', 'Mc 9,30-37', 'Mc 9,38-40', 'Mc 9,41-50', 'Mc 10,1-12', 'Mc 10,13-16'],
    ['Mc 10,17-27', 'Mc 10,28-31', 'Mc 10,32-45', 'Mc 10,46-52', 'Mc 11,11-25', 'Mc 11,27-33'],
    ['Mc 12,1-12', 'Mc 12,13-17', 'Mc 12,18-27', 'Mc 12,28-34', 'Mc 12,35-37', 'Mc 12,38-44'],
    ['Mt 5,1-12', 'Mt 5,13-16', 'Mt 5,17-19', 'Mt 5,20-26', 'Mt 5,27-32', 'Mt 5,33-37'],
    ['Mt 5,38-42', 'Mt 5,43-48', 'Mt 6,1-6.16-18', 'Mt 6,7-15', 'Mt 6,19-23', 'Mt 6,24-34'],
    ['Mt 7,1-5', 'Mt 7,6.12-14', 'Mt 7,15-20', 'Mt 7,21-29', 'Mt 8,1-4', 'Mt 8,5-17'],
    ['Mt 8,18-22', 'Mt 8,23-27', 'Mt 8,28-34', 'Mt 9,1-8', 'Mt 9,9-13', 'Mt 9,14-17'],
    ['Mt 9,18-26', 'Mt 9,32-38', 'Mt 10,1-7', 'Mt 10,7-15', 'Mt 10,16-23', 'Mt 10,24-33'],
    ['Mt 10,34-11,1', 'Mt 11,20-24', 'Mt 11,25-27', 'Mt 11,28-30', 'Mt 12,1-8', 'Mt 12,14-21'],
    ['Mt 12,38-42', 'Mt 12,46-50', 'Mt 13,1-9', 'Mt 13,10-17', 'Mt 13,18-23', 'Mt 13,24-30'],
    ['Mt 13,31-35', 'Mt 13,36-43', 'Mt 13,44-46', 'Mt 13,47-53', 'Mt 13,54-58', 'Mt 14,1-12'],
    ['Mt 14,13-21', 'Mt 14,22-36', 'Mt 15,21-28', 'Mt 16,13-23', 'Mt 16,24-28', 'Mt 17,14-20'],
    ['Mt 17,22-27', 'Mt 18,1-5.10.12-14', 'Mt 18,15-20', 'Mt 18,21-19,1', 'Mt 19,3-12', 'Mt 19,13-15'],
    ['Mt 19,16-22', 'Mt 19,23-30', 'Mt 20,1-16', 'Mt 22,1-14', 'Mt 22,34-40', 'Mt 23,1-12'],
    ['Mt 23,13-22', 'Mt 23,23-26', 'Mt 23,27-32', 'Mt 24,42-51', 'Mt 25,1-13', 'Mt 25,14-30'],
    ['Lc 4,16-30', 'Lc 4,31-37', 'Lc 4,38-44', 'Lc 5,1-11', 'Lc 5,33-39', 'Lc 6,1-5'],
    ['Lc 6,6-11', 'Lc 6,12-19', 'Lc 6,20-26', 'Lc 6,27-38', 'Lc 6,39-42', 'Lc 6,43-49'],
    ['Lc 7,1-10', 'Lc 7,11-17', 'Lc 7,31-35', 'Lc 7,36-50', 'Lc 8,1-3', 'Lc 8,4-15'],
    ['Lc 8,16-18', 'Lc 8,19-21', 'Lc 9,1-6', 'Lc 9,7-9', 'Lc 9,18-22', 'Lc 9,43b-45'],
    ['Lc 9,46-50', 'Lc 9,51-56', 'Lc 9,57-62', 'Lc 10,1-12', 'Lc 10,13-16', 'Lc 10,17-24'],
    ['Lc 10,25-37', 'Lc 10,38-42', 'Lc 11,1-4', 'Lc 11,5-13', 'Lc 11,15-26', 'Lc 11,27-28'],
    ['Lc 11,29-32', 'Lc 11,37-41', 'Lc 11,42-46', 'Lc 11,47-54', 'Lc 12,1-7', 'Lc 12,8-12'],
    ['Lc 12,13-21', 'Lc 12,35-38', 'Lc 12,39-48', 'Lc 12,49-53', 'Lc 12,54-59', 'Lc 13,1-9'],
    ['Lc 13,10-17', 'Lc 13,18-21', 'Lc 13,22-30', 'Lc 13,31-35', 'Lc 14,1-6', 'Lc 14,1.7-11'],
    ['Lc 14,12-14', 'Lc 14,15-24', 'Lc 14,25-33', 'Lc 15,1-10', 'Lc 16,1-8', 'Lc 16,9-15'],
    ['Lc 17,1-6', 'Lc 17,7-10', 'Lc 17,11-19', 'Lc 17,20-25', 'Lc 17,26-37', 'Lc 18,1-8'],
    ['Lc 18,35-43', 'Lc 19,1-10', 'Lc 19,11-28', 'Lc 19,41-44', 'Lc 19,45-48', 'Lc 20,27-40'],
    ['Lc 21,1-4', 'Lc 21,5-11', 'Lc 21,12-19', 'Lc 21,20-28', 'Lc 21,29-33', 'Lc 21,34-36'],
  ];

  // santi e feste a data fissa: [nome, grado, Vangelo] (grado 3 solennità, 5 festa del Signore, 7 festa, 10 memoria con Vangelo proprio)
  const SANTI = {
    '01-25': ['Conversione di san Paolo, apostolo', 7, 'Mc 16,15-18'],
    '01-26': ['Santi Timoteo e Tito, vescovi', 10, 'Lc 10,1-9'],
    '02-02': ['Presentazione del Signore', 5, 'Lc 2,22-40'],
    '02-14': ['Santi Cirillo e Metodio, patroni d’Europa', 7, 'Lc 10,1-9'],
    '02-22': ['Cattedra di san Pietro, apostolo', 7, 'Mt 16,13-19'],
    '03-19': ['San Giuseppe, sposo della Beata Vergine Maria', 3, 'Mt 1,16.18-21.24a'],
    '03-25': ['Annunciazione del Signore', 3, 'Lc 1,26-38'],
    '04-25': ['San Marco, evangelista', 7, 'Mc 16,15-20'],
    '04-29': ['Santa Caterina da Siena, patrona d\'Italia', 7, 'Mt 11,25-30'],
    '05-03': ['Santi Filippo e Giacomo, apostoli', 7, 'Gv 14,6-14'],
    '05-14': ['San Mattia, apostolo', 7, 'Gv 15,9-17'],
    '05-31': ['Visitazione della Beata Vergine Maria', 7, 'Lc 1,39-56'],
    '06-11': ['San Barnaba, apostolo', 10, 'Mt 10,7-13'],
    '06-24': ['Natività di san Giovanni Battista', 3, 'Lc 1,57-66.80'],
    '06-29': ['Santi Pietro e Paolo, apostoli', 3, 'Mt 16,13-19'],
    '07-03': ['San Tommaso, apostolo', 7, 'Gv 20,24-29'],
    '07-11': ['San Benedetto, abate, patrono d’Europa', 7, 'Mt 19,27-29'],
    '07-22': ['Santa Maria Maddalena', 7, 'Gv 20,1-2.11-18'],
    '07-23': ['Santa Brigida, religiosa, patrona d’Europa', 7, 'Gv 15,1-8'],
    '07-25': ['San Giacomo, apostolo', 7, 'Mt 20,20-28'],
    '07-26': ['Santi Gioacchino e Anna, genitori della Beata Vergine Maria', 10, 'Mt 13,16-17'],
    '07-29': ['Santi Marta, Maria e Lazzaro', 10, 'Gv 11,19-27'],
    '08-06': ['Trasfigurazione del Signore', 5, { A: 'Mt 17,1-9', B: 'Mc 9,2-10', C: 'Lc 9,28b-36' }],
    '08-09': ['Santa Teresa Benedetta della Croce, patrona d’Europa', 7, 'Mt 25,1-13'],
    '08-10': ['San Lorenzo, diacono e martire', 7, 'Gv 12,24-26'],
    '08-15': ['Assunzione della Beata Vergine Maria', 3, 'Lc 1,39-56'],
    '08-22': ['Beata Vergine Maria Regina', 10, 'Lc 1,26-38'],
    '08-24': ['San Bartolomeo, apostolo', 7, 'Gv 1,45-51'],
    '08-29': ['Martirio di san Giovanni Battista', 10, 'Mc 6,17-29'],
    '09-08': ['Natività della Beata Vergine Maria', 7, 'Mt 1,1-16.18-23'],
    '09-14': ['Esaltazione della Santa Croce', 5, 'Gv 3,13-17'],
    '09-15': ['Beata Vergine Maria Addolorata', 10, 'Gv 19,25-27'],
    '09-21': ['San Matteo, apostolo ed evangelista', 7, 'Mt 9,9-13'],
    '09-29': ['Santi Michele, Gabriele e Raffaele, arcangeli', 7, 'Gv 1,47-51'],
    '10-02': ['Santi Angeli custodi', 10, 'Mt 18,1-5.10'],
    '10-04': ['San Francesco d\'Assisi, patrono d\'Italia', 7, 'Mt 11,25-30'],
    '10-07': ['Beata Vergine Maria del Rosario', 10, 'Lc 1,26-38'],
    '10-18': ['San Luca, evangelista', 7, 'Lc 10,1-9'],
    '10-28': ['Santi Simone e Giuda, apostoli', 7, 'Lc 6,12-19'],
    '11-01': ['Tutti i Santi', 3, 'Mt 5,1-12a'],
    '11-02': ['Commemorazione di tutti i fedeli defunti', 3, 'Mt 25,31-46'],
    '11-09': ['Dedicazione della Basilica Lateranense', 5, 'Gv 2,13-22'],
    '11-21': ['Presentazione della Beata Vergine Maria', 10, 'Mt 12,46-50'],
    '11-30': ['Sant\'Andrea, apostolo', 7, 'Mt 4,18-22'],
    '12-08': ['Immacolata Concezione della Beata Vergine Maria', 3, 'Lc 1,26-38'],
  };

  /* ------------------------------------------------------------------ date */

  const DAY = 86400000;
  const D = (y, m, d) => Date.UTC(y, m - 1, d);
  const add = (t, n) => t + n * DAY;
  const dow = (t) => new Date(t).getUTCDay();
  const diff = (a, b) => Math.round((a - b) / DAY);
  const sundayOnOrBefore = (t) => add(t, -dow(t));
  const key = (t) => {
    const x = new Date(t);
    return `${String(x.getUTCMonth() + 1).padStart(2, '0')}-${String(x.getUTCDate()).padStart(2, '0')}`;
  };

  function pasqua(y) {   // algoritmo di Meeus/Jones/Butcher (calendario gregoriano)
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return D(y, month, day);
  }
  const primaAvvento = (y) => add(sundayOnOrBefore(D(y, 12, 24)), -21);
  const battesimo = (y) => add(D(y, 1, 6), 7 - dow(D(y, 1, 6)));   // domenica dopo l'Epifania (6 gennaio)

  const ROMANI = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI',
    'XVII', 'XVIII', 'XIX', 'XX', 'XXI', 'XXII', 'XXIII', 'XXIV', 'XXV', 'XXVI', 'XXVII', 'XXVIII', 'XXIX', 'XXX', 'XXXI',
    'XXXII', 'XXXIII', 'XXXIV'];
  const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

  /* ------------------------------------------------------------------ tempo liturgico */

  function tempo(t) {
    const y = new Date(t).getUTCFullYear();
    const E = pasqua(y), ceneri = add(E, -46), palme = add(E, -7), pent = add(E, 49);
    const adv1 = primaAvvento(y), re = add(adv1, -7), natale = D(y, 12, 25), batt = battesimo(y);
    const annoLit = t >= adv1 ? y + 1 : y;
    const ciclo = { 1: 'A', 2: 'B', 0: 'C' }[annoLit % 3];
    const g = dow(t);
    const r = (nome, vangelo, grado) => ({ nome, vangelo, grado, ciclo, anno: annoLit % 2 ? 'I' : 'II' });

    // Natale fino al Battesimo del Signore
    if (t < batt || t >= natale) {
      if (t === batt) return r('Battesimo del Signore', BATTESIMO[ciclo], 5);
      if (t >= natale) {
        const famiglia = [26, 27, 28, 29, 30, 31].map((d) => D(y, 12, d)).find((x) => dow(x) === 0) ?? D(y, 12, 30);
        if (t === famiglia) return r('Santa Famiglia di Gesù, Maria e Giuseppe', SACRA_FAMIGLIA[ciclo], 5);
      }
      const k = key(t);
      if (g === 0 && ['01-02', '01-03', '01-04', '01-05'].includes(k)) return r('II Domenica dopo Natale', 'Gv 1,1-18', 6);
      const [nome, vangelo] = NATALE[k];
      const grado = { '12-25': 1, '01-01': 3, '01-06': 2, '12-26': 7, '12-27': 7, '12-28': 7 }[k] ?? (k.startsWith('12') ? 9 : 13);
      return r(nome, vangelo, grado);
    }
    if (t === batt) return r('Battesimo del Signore', BATTESIMO[ciclo], 5);

    // Tempo Ordinario prima della Quaresima
    if (t < ceneri) {
      const w = Math.floor(diff(t, batt) / 7) + 1;
      return g === 0
        ? r(`${ROMANI[w]} Domenica del Tempo Ordinario`, TO_DOM[ciclo][w - 2], 6)
        : r(`${GIORNI[g]} della ${ROMANI[w]} settimana del Tempo Ordinario`, TO_FER[w - 1][g - 1], 13);
    }
    // Quaresima
    if (t < palme) {
      if (t === ceneri) return r('Mercoledì delle Ceneri', CENERI[0], 2);
      if (t < add(ceneri, 4)) return r(`${GIORNI[g]} dopo le Ceneri`, CENERI[diff(t, ceneri)], 9);
      const w = Math.floor(diff(t, add(ceneri, 4)) / 7) + 1;
      return g === 0
        ? r(`${ROMANI[w]} Domenica di Quaresima`, QUA_DOM[ciclo][w - 1], 2)
        : r(`${GIORNI[g]} della ${ROMANI[w]} settimana di Quaresima`, QUA_FER[w - 1][g - 1], 9);
    }
    // Settimana Santa e Triduo
    if (t < E) {
      const n = diff(t, palme);
      if (n === 0) return r('Domenica delle Palme e della Passione del Signore', PALME[ciclo], 2);
      if (n <= 3) return r(`${GIORNI[g]} Santo`, SETTIMANA_SANTA[n - 1], 2);
      if (n === 4) return r('Giovedì Santo (Messa nella Cena del Signore)', 'Gv 13,1-15', 1);
      if (n === 5) return r('Venerdì Santo (Passione del Signore)', 'Gv 18,1-19,42', 1);
      return r('Sabato Santo (Veglia pasquale)', VEGLIA[ciclo], 1);
    }
    // Tempo di Pasqua
    if (t <= pent) {
      const n = diff(t, E);
      if (n === 0) return r('Pasqua di Risurrezione del Signore', 'Gv 20,1-9', 1);
      if (n < 7) return r(`${GIORNI[g]} fra l'ottava di Pasqua`, OTTAVA_PASQUA[n - 1], 2);
      if (n === 42) return r('Ascensione del Signore', ASCENSIONE[ciclo], 2);   // in Italia di domenica
      if (n === 49) return r('Pentecoste', PENTECOSTE[ciclo], 2);
      const w = Math.floor(n / 7) + 1;
      if (g === 0) return r(`${ROMANI[w]} Domenica di Pasqua`, PAS_DOM[ciclo][w - 2], 2);
      let v = PAS_FER[w - 2][g - 1];
      if (w === 4 && g === 1 && ciclo === 'A') v = 'Gv 10,11-18';   // anno A: la domenica ha già letto Gv 10,1-10
      return r(`${GIORNI[g]} della ${ROMANI[w]} settimana di Pasqua`, v, 13);
    }
    // Tempo Ordinario dopo Pentecoste
    if (t < adv1) {
      const n = diff(t, pent);
      if (n === 7) return r('Santissima Trinità', TRINITA[ciclo], 3);
      if (n === 14) return r('Santissimo Corpo e Sangue di Cristo', CORPUS[ciclo], 3);   // in Italia di domenica
      if (n === 19) return r('Sacratissimo Cuore di Gesù', SACRO_CUORE[ciclo], 3);
      if (t === re) return r('Nostro Signore Gesù Cristo Re dell\'universo', CRISTO_RE[ciclo], 3);
      const w = 34 - Math.floor(diff(re, sundayOnOrBefore(t)) / 7);
      if (g === 0) return r(`${ROMANI[w]} Domenica del Tempo Ordinario`, TO_DOM[ciclo][w - 2], 6);
      let v = TO_FER[w - 1][g - 1];
      if (w === 18 && ciclo === 'A' && g === 1) v = 'Mt 14,22-36';             // anno A: la domenica legge Mt 14,13-21
      if (w === 18 && ciclo === 'A' && g === 2) v = 'Mt 15,1-2.10-14';
      return r(`${GIORNI[g]} della ${ROMANI[w]} settimana del Tempo Ordinario`, v, 13);
    }
    // Avvento
    const w = Math.floor(diff(t, adv1) / 7) + 1;
    if (g === 0) return r(`${ROMANI[w]} Domenica di Avvento`, ADV_DOM[ciclo][w - 1], 2);
    const giorno = new Date(t).getUTCDate();
    if (new Date(t).getUTCMonth() === 11 && giorno >= 17) return r(`${GIORNI[g]} della ${ROMANI[w]} settimana di Avvento (${giorno} dicembre)`, ADV_DIC[giorno], 9);
    return r(`${GIORNI[g]} della ${ROMANI[w]} settimana di Avvento`, ADV_FER[w - 1][g - 1], 13);
  }

  /* ------------------------------------------------------------------ santi e precedenze */

  function santiDellAnno(y) {
    const E = pasqua(y), palme = add(E, -7), pent = add(E, 49);
    const map = new Map();
    for (const [k, v] of Object.entries(SANTI)) {
      const [m, d] = k.split('-').map(Number);
      let t = D(y, m, d);
      // solennità impedite: si spostano
      if (k === '03-19') {
        if (t >= palme && t <= E) t = add(palme, -1);
        else if (dow(t) === 0) t = add(t, 1);
      } else if (k === '03-25') {
        if (t >= palme && t <= add(E, 7)) t = add(E, 8);
        else if (dow(t) === 0) t = add(t, 1);
      } else if (k === '12-08' && dow(t) === 0) {
        t = add(t, 1);
      }
      map.set(t, v);
    }
    map.set(add(pent, 1), ['Beata Vergine Maria Madre della Chiesa', 10, 'Gv 19,25-34']);
    map.set(add(pent, 20), ['Cuore Immacolato della Beata Vergine Maria', 10, 'Lc 2,41-51']);
    return map;
  }

  const cache = new Map();
  function giornoLiturgico(y, m, d) {
    const t = D(y, m, d);
    const base = tempo(t);
    if (!cache.has(y)) cache.set(y, santiDellAnno(y));
    const santo = cache.get(y).get(t);
    if (santo) {
      const [nome, grado, vangelo] = santo;
      // la memoria vale solo nelle ferie ordinarie (grado 13); feste e solennità se più importanti del giorno
      const vince = grado === 10 ? base.grado === 13 : grado < base.grado;
      if (vince) {
        return { ...base, nome, grado, vangelo: typeof vangelo === 'string' ? vangelo : vangelo[base.ciclo], tempo: base.nome };
      }
    }
    return base;
  }

  root.giornoLiturgico = giornoLiturgico;
  root.pasqua = (y) => new Date(pasqua(y));
  if (typeof module !== 'undefined') module.exports = { giornoLiturgico };
})(typeof window !== 'undefined' ? window : globalThis);
