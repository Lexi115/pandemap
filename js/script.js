/*
    "PandeMap"    
    Covid Map PCTO v. 1.3.4
    Sica Alessio IV A INF 2020/21
*/

// ---------------------------------------------------
//
// ELEMENTI DEL DOM NECESSARI
//
// ---------------------------------------------------

var loadingScreen = document.querySelector("#loadingScreen");
var mapDiv = document.querySelector("#italyMap");
var container = document.querySelector("#container");
var regionsWindow = document.querySelector("#regionsWindow");
var provincesWindow = document.querySelector("#provincesWindow");
var regionHeader = document.querySelector("#regionHeader");
var provincesContent = document.querySelector("#provincesContent");
var visibilityBtn = document.querySelector("#visibilityBtn");
var centerBtn = document.querySelector("#centerBtn");
var toggleModeBtn = document.querySelector("#toggleModeBtn");

// ---------------------------------------------------
//
// IMPOSTAZIONI
//
// ---------------------------------------------------

var areWindowsVisible = true;
var darkThemeEnabled = true;

mapDiv.style.height = window.innerHeight + 'px';

// Regioni e province
var regionsDataUrl = 'https://raw.githubusercontent.com/pcm-dpc/COVID-19/master/dati-json/dpc-covid19-ita-regioni-latest.json';
var provincesDataUrl = 'https://raw.githubusercontent.com/pcm-dpc/COVID-19/master/dati-province/dpc-covid19-ita-province-latest.csv';

var mapStyle = [
    'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
    'https://{s}.basemaps.cartocdn.com/rastertiles/light_nolabels/{z}/{x}/{y}.png'
];

var circles = [];

// Imposta centro della mappa (latitudine - longitudine)
var x = 42.6384261;
var y = 12.674297;
var defaultZoom = 6;

// Imposta colori categorie
var colors = {
    totale_positivi: '#ffa83a',
    deceduti: '#ff3b3b',
    dimessi_guariti: '#55ff55'
}

// Imposta limiti massimi (impedisce di spostarsi abbastanza da non rendere più visibile l'Italia)
var bounds = L.latLngBounds([51.66311, -3.01141], [31.17572, 29.84057]);

// ---------------------------------------------------
//
// CREAZIONE MAPPA
//
// ---------------------------------------------------

// Crea mappa
var mappa = L.map(mapDiv, {
    maxBounds: bounds,
    center: [x, y],
    zoom: defaultZoom
});
var currentMapStyle = L.tileLayer(mapStyle[0], {
    attribution: 'Sica Alessio IV A INF',
    minZoom: 4,
    maxZoom: 10
});
currentMapStyle.addTo(mappa);

mappa.on('click', function () {
    // Nascondi tabella province e mostra quella delle regioni
    provincesWindow.style.display = 'none';
    regionsWindow.style.display = 'block';
});

// ---------------------------------------------------
//
// RICHIESTE HTTP DEI DATI
//
// ---------------------------------------------------

// Ottieni il file JSON contenente i dati aggiornati (regioni)
var regionsRequest = new XMLHttpRequest();
regionsRequest.open('GET', regionsDataUrl);
regionsRequest.responseType = 'json';
regionsRequest.send();

// Evento alla risposta del server
regionsRequest.onload = function () {
    // Ottieni il file CSV contenente i dati aggiornati (province)
    let provincesRequest = new XMLHttpRequest();
    provincesRequest.open('GET', provincesDataUrl);
    provincesRequest.send();

    provincesRequest.onload = function () {
        let regionsData = regionsRequest.response;
        let provincesData = getProvinces(provincesRequest.response);

        // Entrambi i files son stati reperiti?
        if (regionsData != null && provincesData != null) {
            // Visualizza i cerchi sulla mappa
            circles = instantiateCircles(regionsData, provincesData, circles, mappa, 'totale_positivi');

            // Aggiorna tabella regioni
            regionsWindow.innerHTML = getRegionsTable(regionsData);

            // Radio buttons per visualizzare solamente un tipo di dato (positivi, deceduti, guariti)
            let markers = document.querySelectorAll('input[name="markers"]');
            markers[0].checked = true; // Resetta scelta dopo il refresh della pagina (per Firefox)

            markers.forEach(function (marker) {
                marker.addEventListener('change', function () {
                    circles = instantiateCircles(regionsData, provincesData, circles, mappa, marker.value);
                    regionsWindow.innerHTML = getRegionsTable(regionsData);
                })
            });
        } else {
            loadingScreen.innerHTML = 'Impossibile reperire le statistiche, riprovare più tardi.';
            return 1;
        }

        // Nascondi schermata di caricamento
        loadingScreen.style.display = 'none';
    }
}

// ---------------------------------------------------
//
// FUNZIONI
//
// ---------------------------------------------------

function instantiateCircles(regionsData, provincesData, array, map, key) {
    // Riordina lista in base alla chiave selezionata (es. per numero di positivi...)
    reorderListBy(regionsData, key);

    // Rimuovi i vecchi cerchi e disegna i nuovi
    array = removeCircles(array, map);
    array = drawCircles(regionsData, map, key, colors[key]);

    array.forEach(function (pair) {
        pair.circle.addEventListener('click', function () {
            reorderListBy(provincesData[pair.regionName], 1);
            provincesContent.innerHTML = getProvincesTable(provincesData[pair.regionName]);

            // Header tabella province (stemma + nome regione)
            regionHeader.innerHTML = '';
            let flag = new Image();
            flag.src = 'res/images/flags/' + pair.regionName + '.svg';
            regionHeader.append(flag, pair.regionName);

            // Nascondi tabella regioni e mostra quella delle province
            regionsWindow.style.display = 'none';
            provincesWindow.style.display = 'block';
        });
    });

    return array;
}

function drawCircles(data, map, keyValue, cColor) {
    // Array contenente i puntatori agli oggetti cerchio (per rimuoverli in seguito dalla mappa)
    let array = [];

    let maxValue = data[0][keyValue];
    let minValue = data[data.length - 1][keyValue];
    let interval = [10000, 60000];

    for (let i = 0; i < data.length; i++) {
        let c = L.circle([data[i].lat, data[i].long], {
            color: cColor,
            fillColor: cColor,
            fillOpacity: 0.5,
            // Fai rientrare il numero nell'intervallo "interval" (in modo da mantenere dimensioni proporzionali)
            radius: findEquivalentInRange(data[i][keyValue], minValue, maxValue, interval[0], interval[1])
        });

        // Mostra popup non appena si clicca sul cerchio
        c.bindPopup('<b>' + data[i].denominazione_regione + '</b><br>' +
            'Positivi: ' + data[i].totale_positivi + '<br>' +
            'Deceduti: ' + data[i].deceduti + '<br>' +
            'Guariti: ' + data[i].dimessi_guariti + '<br>'
        );

        c.addTo(map);

        let circleInfo = {
            regionName: data[i].denominazione_regione,
            circle: c
        }

        array.push(circleInfo);
    }

    return array;
}

function removeCircles(array, map) {
    for (let i = 0; i < array.length; i++)
        array[i].circle.removeFrom(map);

    return [];
}

function reorderListBy(data, key) {
    let sup = data.length, lastSwap;

    while (sup != -1) {
        lastSwap = -1;

        for (let i = 0; i < sup - 1; i++) {
            if (data[i][key] < data[i + 1][key]) {
                let tmp = data[i];
                data[i] = data[i + 1];
                data[i + 1] = tmp;

                lastSwap = i + 1;
            }
        }

        sup = lastSwap;
    }
}

function findEquivalentInRange(num, oldMin, oldMax, newMin, newMax) {
    return (((num - oldMin) * (newMax - newMin)) / (oldMax - oldMin)) + newMin;
}

function getRegionsTable(data) {
    // Header tabella
    let info = '<table><tr><th>Regione</th><th>Positivi</th><th>Deceduti</th><th>Guariti</th></tr>';

    for (let i = 0; i < data.length; i++) {
        // Compila riga tabella per regione
        info = info.concat(
            '<tr><td>',
            data[i].denominazione_regione,
            '</td><td id="positives">',
            data[i].totale_positivi,
            '</td><td id="deceased">',
            data[i].deceduti,
            '</td><td id="healed">',
            data[i].dimessi_guariti,
            '</td></tr>'
        );
    }

    // Data ultimo aggiornamento
    info = info.concat('</table><p id="data">Dati del: ', data[0].data.substring(0, 10) + "</p>");
    return info;
}

function getProvincesTable(data) {
    // Header tabella
    let info = '<table></div><tr><th>Provincia</th><th>Casi Totali</th></tr>';

    for (let i = 0; i < data.length; i++) {
        // Compila riga tabella per regione
        info = info.concat(
            '<tr><td>',
            data[i][0],
            '</td><td id="totalCases">',
            data[i][1],
            '</td></tr>'
        );
    }

    info = info.concat('</table>');
    return info;
}

function getProvinces(data) {
    // Suddividi file CSV in un array di stringhe (una per riga)
    let lines = data.split('\n');

    let i = 1;
    let list = {}, element = [];

    while (i < lines.length) {
        let fields = lines[i].split(',');
        let regionName = fields[3];
        let provinceName = fields[5];
        let totalCases = parseInt(fields[9]);

        // Passa alla prossima regione una volta finite le province
        if (fields[6] == '') {
            list[regionName] = element;
            element = [];
            i += 2;
        } else {
            element.push([provinceName, totalCases]);
            i++;
        }
    }

    return list;
}


window.onresize = function () {
    mapDiv.style.height = window.innerHeight + 'px';
}

// ---------------------------------------------------
//
// PULSANTI CUSTOM
//
// ---------------------------------------------------

// Pulsante per nascondere / mostrare tabelle
visibilityBtn.onclick = function () {
    areWindowsVisible = !areWindowsVisible;
    container.style.display = areWindowsVisible ? 'block' : 'none';
    visibilityBtn.querySelector("img").src = "res/images/gui/eye_" + areWindowsVisible + ".svg";
}

// Pulsante per ricentrare la mappa sull'Italia
centerBtn.onclick = function () {
    mappa.setView([x, y], defaultZoom);
}

// Pulsante per cambiare il tema (notte / giorno)
toggleModeBtn.onclick = function () {
    currentMapStyle.removeFrom(mappa);
    currentMapStyle = L.tileLayer(mapStyle[darkThemeEnabled ? 1 : 0], {
        attribution: 'Sica Alessio IV A INF',
        minZoom: 4,
        maxZoom: 10
    }).addTo(mappa);

    darkThemeEnabled = !darkThemeEnabled;
    toggleModeBtn.querySelector("img").src = "res/images/gui/theme_" + darkThemeEnabled + ".svg";
}