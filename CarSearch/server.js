﻿var cheerio = require('cheerio');
var log4js = require('log4js');
var logger = log4js.getLogger();

var cars = [];
var car_persist = [];

log4js.replaceConsole()

var express = require('express');
var app = express();

// Routes 
app.use(express.static('static_files'));
app.get('/', function (req, res) { 
    res.redirect('/CarSearch.html');
});

app.get('/data.json', function (req, res) {
    cars.sort(function (a, b) {
        return b.score - a.score;
    });
    res.json(cars);
});


app.listen(1337);


const writeJSON = function(toPersist) {
    fs.writeFile('./data.json', JSON.stringify(toPersist, null, 2), 'utf-8');
};

const getContent = function (url) {
    // return new pending promise
    return new Promise((resolve, reject) => {
        // select http or https module, depending on reqested url
        const lib = url.startsWith('https') ? require('https') : require('http');
        const request = lib.get(url, (response) => {
            // handle http errors
            if (response.statusCode < 200 || response.statusCode > 299) {
                reject(new Error('Failed to load page, status code: ' + response.statusCode));
            }
            // temporary data holder
            const body = [];
            // on every content chunk, push it to the data array
            response.on('data', (chunk) => body.push(chunk));
            // we are done, resolve promise with those joined chunks
            response.on('end', () => resolve(body.join('')));
        });
        // handle connection errors of the request
        request.on('error', (err) => reject(err))
    })
};

var high_score = 0;

const processCar = function (car) {
    var missing = false;
    var score = 0;
    for (var option in car) {
        if (!car[option]) {
            missing = true;
        } else {
            score++;
        }
    }

    car["score"] = score;


    if (score >= high_score) {
        logger.debug("Potential high score of " + score + " by vin: " + car["vin"]);
        high_score = score;
    }

    if (!missing) {
        logger.debug("Potential car: " + car["vin"]);
    } else {
        logger.debug("No luck on vin: " + car["vin"]);
    }

    // Only matters if it has the following attributes:

    // M3 Criteria
    if (car["automatic"] &&
        car["upholstery"].includes("X3SW")) {
    //if (car["drive_assist"] &&
    //    car["ceramic-controls"] &&
    //    car["adaptive-drive"] &&
    //    car["leather-dash"]) {
        cars.push(car);
        console.info("Added car to cars table: " + car["leather-dash"]);
    } else {
        console.log("Failed to match filter criteria, skipping");
    }
    car_persist.push(car);
    writeJSON(car_persist);

};

const getVinInfo = function (vin_string) {
    for (var index = 0; index < car_persist.length; index++) {
        if (car_persist[index].vin == vin_string) {
            logger.debug("Car already existed, returning!");
            processCar(car_persist[index]);
            return;
        }
    }
    //VIN is a string; get last 7 digits
    var last_six = vin_string.substr(vin_string.length - 7);
    var url = 'https://www.bmwdecoder.com/decode/' + last_six;
    getContent(url)
        .then((html) => {
            var parsed = cheerio.load(html);
            var carInfo = parsed('div.carInfo');
            var vinData = cheerio('table#vinData.table', carInfo);
            logger.debug("before vin pull");
            var vin = cheerio('td:contains("VIN")', vinData).next().text();
            logger.debug("after vin pull");

            if (!vin) {
                logger.error("Failed to pull vin on: " + vin_string + ", retrying");
                getVinInfoDelayed(vin_string);
                return;
            } else {
                logger.debug("successfully pulled vin: " + vin);
            }

            var car = {};
            car["vin"] = vin;
            car["color"] = cheerio('td:contains("Colour")', vinData).next().text();
            car["upholstery"] = cheerio('td:contains("Upholstery")', vinData).next().text();
            car["prod-date"] = cheerio('td:contains("Prod. Date")', vinData).next().text();

            //car["m-sport"] = cheerio('td:contains("337")', carInfo).next().text();
            car["lane-change-warn"] = cheerio('td:contains("5AG")', carInfo).next().text();
            car["drive_assist"] = cheerio('td:contains("5AS")', carInfo).next().text();
            car["sun-visor"] = cheerio('td:contains("415")', carInfo).next().text();
            //car["comfort-seats"] = cheerio('td:contains("456")', carInfo).next().text();
            //car["vent-seats"] = cheerio('td:contains("S453A")', carInfo).next().text();
            //car["ceramic-controls"] = cheerio('td:contains("4U1")', carInfo).next().text();
            car["adaptive-drive"] = cheerio('td:contains("2VA")', carInfo).next().text();
            car["leather-dash"] = cheerio('td:contains("4M5")', carInfo).next().text();
            //car["soft-close"] = cheerio('td:contains("323")', carInfo).next().text();
            car["heads-up-display"] = cheerio('td:contains("610")', carInfo).next().text();
            car["speed-limit-indicator"] = cheerio('td:contains("8TH")', carInfo).next().text();
            car["enhanced-bt"] = cheerio('td:contains("6NS")', carInfo).next().text();
            car["automatic"] = cheerio('td:contains("S2MKA")', carInfo).next().text();
            car["adaptive_led"] = cheerio('td:contains("S552A")', carInfo).next().text();
            logger.debug("before process");
            processCar(car);
            logger.debug("after process");

        })
        .catch((err) => {
            console.error("Got Error from BMWDecoder: " + err + " for url " + url);
            getVinInfoDelayed(vin);
        });
};



const getListingPage = function (offset, query_string) {
    logger.debug("query_string is: " + query_string);
    var bmw_url = 'http://cpo.bmwusa.com/used-inventory/index.htm?start=' + offset + query_string;
    logger.debug("URL is: " + bmw_url);
    getContent('http://cpo.bmwusa.com/used-inventory/index.htm?start=' + offset + query_string)
        .then((html) => {
            var parsed = cheerio.load(html);
            parsed('div.hproduct.auto.bmw').map(function (i, foo) {
                // the foo html element into a cheerio object (same pattern as jQuery)
                vin = cheerio(foo).attr('data-vin')
                getVinInfoDelayed(vin);
            })
            getListingPage(offset + 16, query_string);

        })
        .catch((err) => console.error("Failed to load listing page: " + err));
};


function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

const getVinInfoDelayed = function (vin_string) {
    logger.debug("getVinInfo called with: " + vin_string);
    setTimeout(getVinInfo(vin_string), getRandomInt(0,60000));
}


var fs = require("fs");
logger.debug("\n *START* \n");
try {
    car_persist = JSON.parse(fs.readFileSync("./data.json"));
    logger.info("Read file successfully");
} catch (err) {
    logger.error("Got error reading data.json: " + err);
}
logger.debug("hello?\n");
logger.log(JSON.stringify(cars));
logger.debug("Woot!\n");

//getListingPage(0, '&compositeType=certified&superModel=5+Series&gvModel=550i&searchLinkText=SEARCH&showSelections=true&geoRadius=0&facetbrowse=true&year=2016-2016&year=2015-2015&year=2014-2014&showFacetCounts=true&showSubmit=true&showRadius=true&geoZip=78256');
//getListingPage(0, '&compositeType=certified&superModel=5+Series&gvModel=550i+xDrive&searchLinkText=SEARCH&showSelections=true&geoRadius=0&facetbrowse=true&year=2016-2016&year=2015-2015&year=2014-2014&showFacetCounts=true&showSubmit=true&showRadius=true&geoZip=78256');
//getVinInfo("D095766");

// M3 Search
//getListingPage(0, '&gvBodyStyle=Sedan&superModel=M+Series&gvModel=M3&compositeType=certified&geoZip=07677&geoRadius=0');
getListingPage(0, '&superModel=M+Series&gvModel=M3&gvBodyStyle=Sedan&year=2016-2016%2C2015-2015&geoZip=78256&geoRadius=0&');
//getVinInfo("j276133");