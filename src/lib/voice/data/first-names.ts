/**
 * Common first names (nominative) used to tell first name from surname in "Tomasz Wróblewski"
 * vs "Wróblewski Tomasz". Not exhaustive — unknown pairs default to "first last" order.
 */
const NAMES = `
Anna Maria Katarzyna Małgorzata Agnieszka Barbara Ewa Krystyna Elżbieta Magdalena Joanna Zofia Aleksandra
Monika Teresa Danuta Natalia Julia Karolina Marta Beata Dorota Halina Jadwiga Janina Grażyna Irena Jolanta
Iwona Paulina Justyna Bożena Urszula Agata Hanna Helena Sylwia Renata Patrycja Alicja Wiktoria Izabela
Weronika Emilia Ewelina Dominika Kamila Marianna Oliwia Gabriela Wanda Lena Amelia Maja Zuzanna Stanisława
Kinga Klaudia Martyna Edyta Lucyna Wioletta Aneta Bogumiła Genowefa Mirosława Jagoda Laura Nikola Milena
Michalina Antonina Pola Liliana Nina Ilona Żaneta Marzena Violetta Wiesława Kornelia Roksana Sandra Angelika
Adrianna Marlena Diana Daria Celina Regina Sabina Józefa Leokadia Czesława Zdzisława Bronisława Kazimiera
Henryka Eugenia Łucja Olga Ksenia Tatiana Oksana Iryna Lidia Elwira Ida Hanna Julianna Malwina Wiktoria
Piotr Krzysztof Andrzej Tomasz Paweł Jan Michał Marcin Stanisław Jakub Adam Marek Łukasz Grzegorz Mateusz
Wojciech Mariusz Dariusz Zbigniew Jerzy Maciej Rafał Robert Kamil Józef Janusz Jacek Tadeusz Kazimierz
Ryszard Mirosław Szymon Sławomir Bartosz Damian Daniel Dawid Przemysław Sebastian Henryk Waldemar Patryk
Roman Adrian Artur Leszek Karol Zdzisław Edward Mieczysław Arkadiusz Czesław Kacper Filip Antoni Franciszek
Aleksander Wiktor Igor Hubert Oskar Bartłomiej Konrad Norbert Radosław Bogdan Witold Zenon Lech Wiesław
Władysław Bolesław Eugeniusz Ireneusz Krystian Marian Emil Dominik Fabian Tymoteusz Julian Leon Ignacy
Stefan Wacław Feliks Edmund Gabriel Ludwik Alan Borys Cezary Eryk Gracjan Jarosław Jędrzej Juliusz Kajetan
Kornel Lucjan Maksymilian Miłosz Nikodem Olaf Remigiusz Seweryn Tobiasz Zygmunt Oleksandr Andrij Serhij
Mykoła Taras Jurij John Michael David Mark Peter Paul
`;

export const FIRST_NAMES: ReadonlySet<string> = new Set(NAMES.split(/\s+/).filter(Boolean));
