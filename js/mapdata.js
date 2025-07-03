'use strict';

import * as Vector from './vectorlib.js';
import * as Bezier from './bezierlib.js';
import * as Utils from './utillib.js';
import {Color} from './colorlib.js';
import * as Config from './../config.js';

export let railTracks = [];
export let markers = [];
export let dynamicMarkers = [];

let visibleMarkers = [];

let uniqueTrackNames = {};

export let testPoint = {x:0,y:0};

let locationData = null;
export let playerMarker = {
    type: 'player',
    position: {x:8192, y:200, z:8192},
    rotation: 0.0,
    minZoom: 0.0,
    hidden: true,
};
let locationUpdateRate = 500;

export let Shops = {
    Common:[]
}

export let matrix = {
    initialize: () => {
        matrix.minX = Infinity;
        matrix.minY = Infinity;
        matrix.minAlt = Infinity;
        matrix.maxX = -Infinity;
        matrix.maxY = -Infinity;
        matrix.maxAlt = -Infinity;

        for(const railTrack of railTracks){
            for(const curve of railTrack.curves){
                matrix.minX = Math.min(matrix.minX, curve.start.x, curve.h1.x, curve.h2.x, curve.end.x);
                matrix.minY = Math.min(matrix.minY, curve.start.z, curve.h1.z, curve.h2.z, curve.end.z);
                matrix.minAlt = Math.min(matrix.minAlt, curve.start.y, curve.h1.y, curve.h2.y, curve.end.y);
                matrix.maxX = Math.max(matrix.maxX, curve.start.x, curve.h1.x, curve.h2.x, curve.end.x);
                matrix.maxY = Math.max(matrix.maxY, curve.start.z, curve.h1.z, curve.h2.z, curve.end.z);
                matrix.maxAlt = Math.max(matrix.maxAlt, curve.start.y, curve.h1.y, curve.h2.y, curve.end.y);
            }
        }
        matrix.width = matrix.maxX-matrix.minX;
        matrix.height = matrix.maxY-matrix.minY;

        console.log(`(${matrix.minX}, ${matrix.minY}) to (${matrix.maxX}, ${matrix.maxY}). Altitude from ${matrix.minAlt} to ${matrix.maxAlt}`);
    }
};

export let view = {
    initialize: () => {
        const mapContainer = document.getElementById('mapContainer');
        let isLandscape = mapContainer.clientWidth > mapContainer.clientHeight;
        view.scale = Math.min(mapContainer.clientWidth/(matrix.width + Config.defaultMapPadding*2), mapContainer.clientHeight/(matrix.height + Config.defaultMapPadding*2));
        view.pixelRatio = window.devicePixelRatio;
        if(isLandscape){
            view.x = (mapContainer.clientWidth*0.6 - (matrix.width * 0.5 + matrix.minX)*view.scale);
            view.y = (matrix.minY - Config.defaultMapPadding) * view.scale;
        }else{
            view.x = -(matrix.minX - Config.defaultMapPadding) * view.scale;
            view.y = -(mapContainer.clientHeight*0.5 - (matrix.height * 0.5 + matrix.minY)*view.scale);
        }
        view.dirty = false;
        view.dynDirty = false;

        view.convertX = x => {
            return x * view.scale * view.pixelRatio + view.x * view.pixelRatio;
        }
        view.convertY = y => {
            return (matrix.minY+matrix.maxY-y) * view.scale * view.pixelRatio - view.y * view.pixelRatio;
        }

        view.unconvertX = x => {
            return (x - view.x) / view.scale;
        }
        view.unconvertY = y => {
            return -((y + view.y) / view.scale - (matrix.minY + matrix.maxY));
        }
    }
}

export let layers = {};

export function reset(){
    railTracks = [];
    markers = [];
}

export function sortTracks(){
    railTracks.sort((a,b) => {
        if(a.curves && b.curves)
            return a.curves[0].start.y-b.curves[b.curves.length-1].end.y;
        return 0;
    });
}

export function sortMarkers(){
    markers.sort(markerSortFunction);
}

function markerSortFunction(a, b){
    (a,b) => {
        if(a.type == 'player') return 1;
        if(b.type == 'player') return -1;
        if(a.type == b.type){
            switch(a.type){
                case 'speed':
                    return b.value-a.value;
                default:
                    return 0;
            }
        }
        if(a.type == 'station') return 1;
        if(b.type == 'station') return -1;
        if(a.type == 'speed') return 1;
        if(b.type == 'speed') return -1;
        if(a.type == 'junction') return 1;
        if(b.type == 'junction') return -1;
        if(a.type == 'service') return 1;
        if(b.type == 'service') return -1;

        if(a.type == 'demonstratorSpawnHint') return -1;
        if(b.type == 'demonstratorSpawnHint') return 1;
        return 0;
    }
}

export function sortShops(){
    for(let shop in Shops){
        Shops[shop].sort((a,b) => {
            return a.name.localeCompare(b.name);
        });
    }
}

export function filterToTrack(trackName, trackNum = 0){
    if(typeof(trackName) == 'string'){
        for(let railTrack of railTracks){
            if(railTrack.name == trackName && railTrack.number == trackNum){
                railTracks = [railTrack];
                break;
            }
        }
    }else if(typeof(trackName) == 'object'){
        let newRailTracks = [];
        for(let railTrack of railTracks){
            for(let filter of trackName){
                if(railTrack.name == filter.name && railTrack.number == (filter.number ?? 0)){
                    newRailTracks.push(railTrack);
                }
            }
        }
        railTracks = newRailTracks;
    }
}

export function addTrack(trackData){
    let newTrack = {
        name: trackData.name,
        curves: [],
        bounds: {min:{x:Infinity,y:Infinity,z:Infinity},max:{x:-Infinity,y:-Infinity,z:-Infinity}},
    };
    if(uniqueTrackNames[trackData.name] == null){
        uniqueTrackNames[trackData.name] = 0;
    }else{
        uniqueTrackNames[trackData.name]++;
    }
    newTrack.number = uniqueTrackNames[trackData.name];

    let yardData = /\[(#)\]|\[(Y)\][_-]\[(.*?)\][_-]\[((.*?)[_-](.*?)[_-](.*?)|.*)\]/.exec(trackData.name);
    if(yardData){
        if(yardData[1]){ // track is [#], thus in yard limits, but not a specific designated yard.
            newTrack.isYard = true;
        }else if(yardData[2]){ // track is [Y], and is a specific yard.
            newTrack.isYard = true;
            newTrack.yardStation = yardData[3]; // Which station the track belongs to
            newTrack.yardDesignation = yardData[4]; // Full yard designation, used on signs
            newTrack.yardName = yardData[5]; // A yard, B yard, C yard, etc.
            newTrack.yardSidingNumber = yardData[6]; // Which siding within the yard
            newTrack.yardUsage = yardData[7]; // Outbound? Parking? Inbound? Loading? That's this.
        }
    }else if(/Turntable Track/.test(newTrack.name)){
        newTrack.isTurntable = true;
    }else if(/\[track (diverging|through)\]/.test(newTrack.name)){
        newTrack.isJunction = true;
    }
    newTrack.randomColor = Color.random();

    for(let i=0; i+1<trackData.points.length; i++){
        const curveStart = trackData.points[i].position;
        const curveHandle1 = trackData.points[i].h2;
        const curveHandle2 = trackData.points[i+1].h1;
        const curveEnd = trackData.points[i+1].position;

        newTrack.curves[i] = {
            start: curveStart,
            h1: curveHandle1,
            h2: curveHandle2,
            end: curveEnd,
            grade: Bezier.estimateGrade(curveStart, curveHandle1, curveHandle2, curveEnd, Config.bezierGradeResolution),
            length: Bezier.estimateLength(curveStart, curveHandle1, curveHandle2, curveEnd, Config.bezierLengthResolution),
            curvature: Bezier.estimateCurvature(curveStart, curveHandle1, curveHandle2, curveEnd, Config.bezierCurvatureResolution),
            randomColor: Color.random(),
            color: '#fff',
            averageHeight: (curveStart.y+curveEnd.y) * 0.5,
            bounds: Bezier.getBounds(curveStart, curveHandle1, curveHandle2, curveEnd),
        }
        newTrack.curves[i].gradeClass = Utils.gradeToClass(newTrack.curves[i].grade);
        newTrack.curves[i].postedSpeed = Utils.radiusToSpeed(1/newTrack.curves[i].curvature);
        if(newTrack.isYard || newTrack.isTurntable) newTrack.curves[i].postedSpeed = Math.min(newTrack.curves[i].postedSpeed, 50);

        newTrack.curves[i].tooltip = [
            `<h2>Rail</h2>"${trackData.name}"${uniqueTrackNames[trackData.name] > 0 ? ' #'+uniqueTrackNames[trackData.name] : ''} Sec${i}`,
            `Max Grade: ${Math.round(newTrack.curves[i].grade*1000)/10}%`,
            `Min Radius: ${Math.round(1/newTrack.curves[i].curvature)} meters`,
            `Top Speed: ${Utils.radiusToSpeed(1/newTrack.curves[i].curvature)} km/h`,
            `Length: ${Math.round(newTrack.curves[i].length*10)/10} meters`,
            `Altitude (ASL): ${Math.round(newTrack.curves[i].averageHeight)-110} meters`,
        ].join('\n');

        newTrack.bounds.min.x = Math.min(newTrack.bounds.min.x, newTrack.curves[i].bounds.min.x);
        newTrack.bounds.max.x = Math.max(newTrack.bounds.max.x, newTrack.curves[i].bounds.max.x);
        newTrack.bounds.min.y = Math.min(newTrack.bounds.min.y, newTrack.curves[i].bounds.min.y);
        newTrack.bounds.max.y = Math.max(newTrack.bounds.max.y, newTrack.curves[i].bounds.max.y);
        newTrack.bounds.min.z = Math.min(newTrack.bounds.min.z, newTrack.curves[i].bounds.min.z);
        newTrack.bounds.max.z = Math.max(newTrack.bounds.max.z, newTrack.curves[i].bounds.max.z);
    }

    railTracks.push(newTrack);
}

export function addJunction(junctionData){
    if(junctionData.name.startsWith('S-') || junctionData.excludeFromJunctionMap)
        junctionData.minZoom = 1;
    else if(junctionData.name.startsWith('W-'))
        junctionData.minZoom = 0.05;
    junctionData.tooltip = `<h2>Junction</h2>"${junctionData.name}" - #${junctionData.index}\n${junctionData.excludeFromJunctionMap ? 'Inv' : 'V'}isible On Map\nLinked Junctions:\n- ${junctionData.linkedJunctions.join('\n- ')}`;
    junctionData.tooltipHitzone = Config.tooltipHitzone.junction;
    markers.push(junctionData);
}

export function addPoi(poiData, level = 0){
    let newPoi = {
        type: poiData.type,
        name: poiData.name,
        color: poiData.color,
        position: poiData.position,
    };
    if(level > 0) newPoi.minZoom = 0.3;

    switch(poiData.type){
        case 'service':
            newPoi.serviceTypes = [];
            if(poiData.repair) newPoi.serviceTypes.push('Repair');
            if(poiData.diesel) newPoi.serviceTypes.push('Diesel');
            if(poiData.charger) newPoi.serviceTypes.push('Charger');
            if(newPoi.serviceTypes.length == 0){
                newPoi.tooltip = '<h1>Service</h1><hr>?';
            }else{
                newPoi.tooltip = '<h1>Service</h1><hr>- '+newPoi.serviceTypes.join('\n- ');
            }
            break;
        case 'station':
            newPoi.maxZoom = 1;
            newPoi.nickname = poiData.nickname;
            newPoi.shorthand = poiData.shorthand;
            newPoi.color = poiData.color;
            newPoi.tooltip = `<h1>${poiData.name}</h1>`;
            break;
        case 'shop':
            newPoi.tooltip = '<h1>Shop</h1><hr><div class="smol" style="columns:2">';
            if(poiData.shopId){
                for(let item of Shops[poiData.shopId]){
                    newPoi.tooltip += `<div>${item.name}${item.count > 1 ? ` (x${item.count})` : ''} - $${item.price}</div>`;
                }
                for(let item of Shops.Common){
                    newPoi.tooltip += `<div class="quiet">${item.name}${item.count > 1 ? ` (x${item.count})` : ''} - $${item.price}</div>`;
                }
            }
            newPoi.tooltip += '</div>';
            break;
        case 'water':
            newPoi.tooltip = '<h1>Water Tower</h1>';
            break;
        case 'coal':
            newPoi.tooltip = '<h1>Coal Tower</h1>';
            break;
        case 'office':
            if(poiData.museum) newPoi.tooltip = '<h1>Museum Office</h1>';
            else if(poiData.military) newPoi.tooltip = '<h1>Military Office</h1>';
            else newPoi.tooltip = '<h1>Office</h1>';
            break;
        case 'demonstratorSpawn':
            newPoi.name = newPoi.name.replace('spawn anchor ', '');
            newPoi.tooltip = `<h2>Demonstrator Spawnpoint</h2>${newPoi.name ?? ''}`;
            break;
        case 'demonstratorSpawnHint':
            newPoi.tooltip = `<h2>Demonstrator Spawn Hint</h2>${newPoi.name ?? ''}`;
            newPoi.radius = poiData.radius;
            break;
        default:
            newPoi.tooltip = `<h1>${newPoi.name}</h1>${poiData.description ? '<hr>'+poiData.description : ''}`;
            newPoi.minZoom = 0.07;
            break;
    }

    if(poiData.type != 'dummy')
        markers.push(newPoi);

    if(poiData.children){
        for(let child of poiData.children){
            addPoi(child, level+(poiData.type == 'dummy' ? 0 : 1));
        }
    }
}

export function addShopItem(itemData){
    let newItem = {
        name: itemData.name,
        price: itemData.price,
        count: itemData.count,
    };
    if(itemData.soldOnlyAt.length == 0){
        for(let item of Shops.Common){
            if(item.name == newItem.name && item.price == newItem.price){
                item.count += newItem.count;
                return;
            }
        }
        Shops.Common.push(newItem);
    }else{
        for(let shop of itemData.soldOnlyAt){
            if(!Shops[shop]) Shops[shop] = [];

            for(let item of Shops[shop]){
                if(item.name == newItem.name && item.price == newItem.price){
                    item.count += newItem.count;
                    return;
                }
            }
            Shops[shop].push(newItem);
        }
    }
}

export function generateTrackSignage(){
    let yardMarkers = {};
    for(const railTrack of railTracks){
        let trackZoneData = {};
        let lastCurve = false;

        let resetTzdGrade = (i=0) => {
            trackZoneData.gradeClass = railTrack.curves[i].gradeClass;
            trackZoneData.gradeDirection = Math.sign(railTrack.curves[i].grade);
            trackZoneData.gradeZoneStart = i;
            trackZoneData.gradeZoneLength = 0;
        };
        let resetTzdSpeed = (i=0) => {
            trackZoneData.postedSpeed = railTrack.curves[i].postedSpeed;
            trackZoneData.speedZoneStart = i;
            trackZoneData.speedZoneLength = 0;
        };

        resetTzdGrade();
        resetTzdSpeed();

        for(let i=0; i<railTrack.curves.length; i++){
            let nextIndex = i+1;
            if(nextIndex == railTrack.curves.length){
                lastCurve = true;
                nextIndex = i;
            }
            //Grade Markers
            trackZoneData.gradeZoneLength += railTrack.curves[i].length;
            if(railTrack.curves[nextIndex].gradeClass != trackZoneData.gradeClass
                || Math.sign(railTrack.curves[nextIndex].grade) != trackZoneData.gradeDirection
                || trackZoneData.gradeZoneLength > Config.maxZoneLength
                || lastCurve){
                if(railTrack.curves[i].gradeClass != 'flat'){
                    let markerIndex = Math.ceil((trackZoneData.gradeZoneStart + i)/2);
                    let markerOffset = (trackZoneData.gradeZoneStart + i) % 2 ? 0.1 : 0.6;
                    let b1 = railTrack.curves[markerIndex].start;
                    let b2 = railTrack.curves[markerIndex].h1;
                    let b3 = railTrack.curves[markerIndex].h2;
                    let b4 = railTrack.curves[markerIndex].end;

                    let newMarker = {
                        type: 'grade',
                        value: railTrack.curves[markerIndex].grade,
                        position: Bezier.evaluatePoint(b1, b2, b3, b4, markerOffset),
                        gradeClass: railTrack.curves[markerIndex].gradeClass,
                        minZoom: Math.max(0.02, Math.min(1.0, 20/trackZoneData.gradeZoneLength)),
                        zoneLength: trackZoneData.gradeZoneLength,
                        zoneCount: i - trackZoneData.gradeZoneStart + 1,
                        tooltipHitzone: {radius:16},
                    }
                    let tangent = newMarker.value > 0
                        ? Bezier.evaluateVelocity(b1, b2, b3, b4, markerOffset)
                        : Bezier.evaluateVelocity(b4, b3, b2, b1, markerOffset);
                    let tangentLength = Math.sqrt(tangent.x * tangent.x + tangent.z * tangent.z) * Math.sign(tangent.y);
                    newMarker.rotation = Math.atan2(tangent.x/tangentLength, tangent.z/tangentLength);
                    newMarker.tooltip = `<h2>Grade</h2>${Math.round(newMarker.value*1000)/10}% Grade\nUphill bearing ${Utils.mod(newMarker.rotation/(Math.PI*2)*360, 360).toFixed(0)}, ${Utils.angleToCardinalDirection(newMarker.rotation)}\nSection Length: ${newMarker.zoneLength.toFixed(1)} meters\nCovers ${newMarker.zoneCount} track sections`;
                    markers.push(newMarker);
                }
                resetTzdGrade(nextIndex);
            }
            //Speed Markers
            trackZoneData.speedZoneLength += railTrack.curves[i].length;
            if(railTrack.curves[nextIndex].postedSpeed != trackZoneData.postedSpeed
                || trackZoneData.speedZoneLength > Config.maxZoneLength
                || lastCurve){
                let markerIndex = Math.ceil((trackZoneData.speedZoneStart + i)/2);
                let markerOffset = (trackZoneData.speedZoneStart + i) % 2 ? 0.2 : 0.7;
                let b1 = railTrack.curves[markerIndex].start;
                let b2 = railTrack.curves[markerIndex].h1;
                let b3 = railTrack.curves[markerIndex].h2;
                let b4 = railTrack.curves[markerIndex].end;

                let newMarker = {
                    type: 'speed',
                    value: railTrack.curves[markerIndex].postedSpeed,
                    position: Bezier.evaluatePoint(b1, b2, b3, b4, markerOffset),
                    zoneLength: trackZoneData.speedZoneLength,
                    zoneCount: i - trackZoneData.speedZoneStart + 1,
                    minZoom: 0.05,
                }
                if((railTrack.isYard || railTrack.isJunction) && newMarker.value > 30){
                    if(newMarker.value > 40) newMarker.minZoom = 5;
                    else newMarker.minZoom = 0.5;
                }
                if(newMarker.value > 80) newMarker.minZoom *= 6.5;
                else if(newMarker.value > 60) newMarker.minZoom *= 5;
                else if(newMarker.value > 40) newMarker.minZoom *= 3;

                if(newMarker.zoneLength > 500) newMarker.minZoom *= 0.15;

                if(newMarker.zoneLength < 35 && newMarker.value > 40) newMarker.minZoom *= 6; 

                newMarker.tooltip = `<h2>Speed</h2>${Math.round(newMarker.value)} km/h\nSection Length: ${newMarker.zoneLength.toFixed(1)} meters\nCovers ${newMarker.zoneCount} track sections`;
                markers.push(newMarker);
                resetTzdSpeed(nextIndex);
            }
        }

        if(railTrack.yardDesignation && railTrack.yardDesignation != '--'){
            if(!yardMarkers[railTrack.yardStation]) yardMarkers[railTrack.yardStation] = {};
            let centerIndex = Math.floor(railTrack.curves.length/2);
            let yardSignPos = railTrack.curves[centerIndex].start;
            if(railTrack.curves.length % 2 == 1){
                let curve = railTrack.curves[centerIndex];
                yardSignPos = Bezier.evaluatePoint(curve.start, curve.h1, curve.h2, curve.end, 0.5);
            }
            if(railTrack.yardName){
                if(!yardMarkers[railTrack.yardStation][railTrack.yardName])
                    yardMarkers[railTrack.yardStation][railTrack.yardName] = {accCenter:{x:0,y:0,z:0},accCount:0};
                yardMarkers[railTrack.yardStation][railTrack.yardName].accCenter.x += yardSignPos.x;
                yardMarkers[railTrack.yardStation][railTrack.yardName].accCenter.y += yardSignPos.y;
                yardMarkers[railTrack.yardStation][railTrack.yardName].accCenter.z += yardSignPos.z;
                yardMarkers[railTrack.yardStation][railTrack.yardName].accCount++;
            }
            let newMarker = {
                type: 'yardSiding',
                name: railTrack.yardDesignation,
                position: yardSignPos,
                minZoom: 2.5,
            };
            if(railTrack.yardName && railTrack.yardSidingNumber && railTrack.yardUsage){
                if(!Config.sidingUsageMeanings[railTrack.yardUsage]) console.log(`Unknown siding usage for ${railTrack.yardDesignation} at ${railTrack.yardStation}`);
                newMarker.tooltip = `<h2>Siding</h2>${railTrack.yardDesignation}\n${Config.sidingUsageMeanings[railTrack.yardUsage]}`;
            }else{
                newMarker.tooltip = `<h2>Siding</h2>${railTrack.yardDesignation}`;
            }
            markers.push(newMarker);
        }
    }

    for(let station in yardMarkers){
        for(let yard in yardMarkers[station]){
            markers.push({
                type: 'yard',
                name: `${yard} Yard`,
                position: {
                    x: yardMarkers[station][yard].accCenter.x/yardMarkers[station][yard].accCount,
                    y: yardMarkers[station][yard].accCenter.y/yardMarkers[station][yard].accCount,
                    z: yardMarkers[station][yard].accCenter.z/yardMarkers[station][yard].accCount,
                },
                tooltip: `<h1>${yard} Yard</h1>`,
                maxZoom: 2.5,
                minZoom: 0.25,
            });
        }
    }
}

/**
 * Finds the relevant tooltip for where the cursor is (if possible)
 * Returns "" if there is none.
 * @param {Number} cursorX 
 * @param {Number} cursorY 
 * @returns {String}
 */
export function testTooltip(cursorX, cursorY){
    cursorX = view.unconvertX(cursorX);
    cursorY = view.unconvertY(cursorY);

    let finalTooltip = '';
    let radius = 0;
    let width = 0;
    let height = 0;
    for(const marker of dynamicMarkers){
        if(!marker.visible) continue;
        if(marker.boundsCheck != null){
            if(marker.boundsCheck(cursorX, cursorY))
                finalTooltip = marker.tooltip ?? finalTooltip;
        }else if(marker.tooltipHitzone && marker.tooltipHitzone.width && marker.tooltipHitzone.height){
            width = marker.tooltipHitzone.width * 0.5/view.scale;
            height = marker.tooltipHitzone.height * 0.5/view.scale;
            if(    marker.position.x - cursorX + (marker.tooltipHitzone.offsetX ?? 0)/view.scale <= width
                && marker.position.x - cursorX + (marker.tooltipHitzone.offsetX ?? 0)/view.scale >= -width
                && marker.position.z - cursorY + (marker.tooltipHitzone.offsetY ?? 0)/view.scale <= height
                && marker.position.z - cursorY + (marker.tooltipHitzone.offsetY ?? 0)/view.scale >= -height){
                finalTooltip = marker.tooltip ?? finalTooltip;
            }
        }else{
            if(marker.tooltipHitzone)
                radius = (marker.tooltipHitzone.radius ?? Config.tooltipHitzone.default.radius) / view.scale;
            else
                radius = Config.tooltipHitzone.default.radius / view.scale;
            if(Math.pow(marker.position.x - cursorX, 2) + Math.pow(marker.position.z - cursorY, 2) <= radius * radius){
                finalTooltip = marker.tooltip ?? finalTooltip;
            }
        }
    }
    if(finalTooltip != '') return finalTooltip;

    for(const marker of markers){
        if(!marker.visible) continue;
        if(marker.boundsCheck != null){
            if(marker.boundsCheck(cursorX, cursorY))
                finalTooltip = marker.tooltip ?? finalTooltip;
        }else if(marker.tooltipHitzone && marker.tooltipHitzone.width && marker.tooltipHitzone.height){
            width = marker.tooltipHitzone.width * 0.5/view.scale;
            height = marker.tooltipHitzone.height * 0.5/view.scale;
            if(    marker.position.x - cursorX + (marker.tooltipHitzone.offsetX ?? 0)/view.scale <= width
                && marker.position.x - cursorX + (marker.tooltipHitzone.offsetX ?? 0)/view.scale >= -width
                && marker.position.z - cursorY + (marker.tooltipHitzone.offsetY ?? 0)/view.scale <= height
                && marker.position.z - cursorY + (marker.tooltipHitzone.offsetY ?? 0)/view.scale >= -height){
                finalTooltip = marker.tooltip ?? finalTooltip;
            }
        }else{
            if(marker.tooltipHitzone)
                radius = (marker.tooltipHitzone.radius ?? Config.tooltipHitzone.default.radius) / view.scale;
            else
                radius = Config.tooltipHitzone.default.radius / view.scale;
            if(Math.pow(marker.position.x - cursorX, 2) + Math.pow(marker.position.z - cursorY, 2) <= radius * radius){
                finalTooltip = marker.tooltip ?? finalTooltip;
            }
        }
    }
    if(finalTooltip != '') return finalTooltip;

    let bestDistance = Infinity;
    let test = {};
    let boundsPadding = 40/view.scale;
    for(const railTrack of railTracks){
        if(cursorX >= railTrack.bounds.min.x - boundsPadding && cursorX <= railTrack.bounds.max.x + boundsPadding && cursorY >= railTrack.bounds.min.z - boundsPadding && cursorY <= railTrack.bounds.max.z + boundsPadding){
            for(const curve of railTrack.curves){
                if(cursorX >= curve.bounds.min.x - boundsPadding && cursorX <= curve.bounds.max.x + boundsPadding && cursorY >= curve.bounds.min.z - boundsPadding && cursorY <= curve.bounds.max.z + boundsPadding){
                    test = Bezier.getNearestPoint2D(curve.start, curve.h1, curve.h2, curve.end, {x:cursorX, y:cursorY}, Math.floor(curve.length*2));
                    if(test.distance < bestDistance){
                        bestDistance = test.distance;
                        finalTooltip = curve.tooltip;
                        testPoint = test.point;
                    }
                }
            }
        }
    }

    return bestDistance <= Math.min(Math.max(0.9, 12/view.scale), 120) ? finalTooltip : '';
}

export function setTrackColorMode(mode){
    let modeFunction;
    const keyElement = document.getElementById('legendKeyColors');
    let gradientString = '';
    keyElement.innerHTML = '';
    switch(mode){
        case 'Track Type':
            modeFunction = (curve, railTrack) => {
                let finalColor = '#aaa';
                if(railTrack.isYard && railTrack.yardDesignation) finalColor = '#4bf';
                else if(railTrack.isYard) finalColor = '#4fb';
                else if(railTrack.isJunction) finalColor = '#fb4';
                else if(railTrack.isTurntable) finalColor = '#b4f';

                curve.color = finalColor;
            };
            keyElement.innerHTML = `
            <span class="colorKey"><span style="background:#4bf"></span> Designated Yard</span>
            <span class="colorKey"><span style="background:#4fb"></span> Other Yard</span>
            <span class="colorKey"><span style="background:#fb4"></span> Point</span>
            <span class="colorKey"><span style="background:#b4f"></span> Turntable</span>
            <span class="colorKey"><span style="background:#aaa"></span> Other Tracks</span>`;
            break;
        case 'Grade':
            modeFunction = curve => {
                curve.color = Config.gradeColors['grade_'+curve.gradeClass];
            };
            for(let grade in Config.gradeColors){
                keyElement.innerHTML += `<span class="colorKey" style="${grade.replace('grade_','') < 6 || grade == 'grade_flat' ? 'color:#000;' : ''}padding:0px 3px;background:${Config.gradeColors[grade]}">${(Utils.classToGrade(grade.replace('grade_',''))*100).toFixed(1)}%</span>`;
            }
            break;
        case 'Altitude':
            modeFunction = (curve, railTrack) => {
                curve.color = Color.blendGradient(Config.altitudeGradient, (curve.averageHeight-matrix.minAlt)/(matrix.maxAlt-matrix.minAlt)).hex;
            }
            gradientString = 'linear-gradient(to right';
            for(let col of Config.altitudeGradient) gradientString += ', '+col.hex;
            gradientString += ')';
            
            keyElement.innerHTML = `
            <div style="display:flex">
                <div>${Math.floor(matrix.minAlt)}m</div>
                <div class="gradientKey" style="flex-grow:1;background:${gradientString}"></div>
                <div>${Math.ceil(matrix.maxAlt)}m</div>
            </div>
            `;
            break;
        case 'Speed':
            modeFunction = curve => {
                curve.color = Color.blendGradient(Config.speedGradient, (curve.postedSpeed+10)/110).hex;
            };
            
            gradientString = 'linear-gradient(to right';
            for(let col of Config.speedGradient) gradientString += ', '+col.hex;
            gradientString += ')';
            keyElement.innerHTML = `
            <div style="display:flex">
                <div>10 kmh</div>
                <div class="gradientKey" style="flex-grow:1;background:${gradientString}"></div>
                <div>120 kmh</div>
            </div>
            `;
            break;
        case 'Track Random':
            modeFunction = (curve, railTrack) => {
                curve.color = railTrack.randomColor.hex;
            };
            keyElement.innerHTML = 'Random per continuous track section';
            break;
        case 'Curve Random':
            modeFunction = curve => {
                curve.color = curve.randomColor.hex;
            };
            keyElement.innerHTML = 'Random per individual track bezier curve';
            break;
        default:
            modeFunction = curve => {
                curve.color = '#fff';
            };
            break;
    }
    if(modeFunction != null){
        for(let railTrack of railTracks){
            for(let curve of railTrack.curves){
                modeFunction(curve, railTrack);
            }
        }
    }
    view.dirty = true;
}

export function setLocationUpdateRate(rate){
    locationUpdateRate = rate;
}

export function connectPlayerLocation(address, status){
    if(!address.startsWith('http://')){
        address.replaceAll(/.*:\/\//g, '');
        address = 'http://' + address;
    }
    address += '/location';
    console.log(`Connecting to game at ${address}`);
    let started = false;
    const endConnect = () => {
        locationData = null;
        dynamicMarkers = [];
        status.value = 'Connect';
        playerMarker.hidden = true;
        view.dynDirty = true;
    }
    const pingLocation = async () => {
        if(locationData == null && started){
            endConnect();
            return;
        }
        status.value = 'Disconnect...';
        try {
            const fetchRequest = await fetch(new Request(address), {signal: AbortSignal.timeout(5000)});
            if(!fetchRequest.ok || (locationData == null && started)){
                endConnect();
                return;
            }
            status.value = 'Disconnect   ';
            locationData = await (fetchRequest).json();
            playerMarker.position = {
                x: locationData.x,
                y: locationData.y,
                z: locationData.z,
            };
            playerMarker.rotation = locationData.rotation;
            playerMarker.tooltip = `<h1>Player</h1>X: ${playerMarker.position.x.toFixed(2)}\nY: ${playerMarker.position.y.toFixed(2)}\nZ: ${playerMarker.position.z.toFixed(2)}\nBearing ${(playerMarker.rotation * (180/Math.PI)).toFixed(1)} (${Utils.angleToCardinalDirection(playerMarker.rotation)})`;
            playerMarker.hidden = false;

            dynamicMarkers = [];
            if(!locationData.cars) locationData.cars = [];
            for(let car of locationData.cars){
                car.name = car.name.replaceAll('(Clone)', '').replaceAll('_',' ').replaceAll(/(Car|Loco)/g, '');
                dynamicMarkers.push({
                    type: 'car',
                    name: 'car.id',
                    position: {
                        x: car.x,
                        y: car.y,
                        z: car.z
                    },
                    length: car.length - 0.5,
                    width: 2.0,
                    rotation: car.rotation,
                    guid: car.carGuid,
                    isLoco: car.isLoco,
                    tooltip: `<h1>${car.id}</h1>Type: ${car.name}\nLength: ${car.length.toFixed(1)}m${car.speed >= 0.1 ? `\nSpeed: ${(car.speed * 3.6).toFixed(1)} km/h` : '' }${car.derailed ? '\nDerailed!' : ''}`,
                    derailed: car.derailed,
                    isPlayer: car.isPlayer,
                    isActive: car.isActive,
                });
            }
            dynamicMarkers.push(playerMarker);

            started = true;
            view.dynDirty = true;
            setTimeout(pingLocation, locationUpdateRate);
        }catch(e){
            endConnect();
            console.log(e);
        }
    }
    pingLocation();
}

export function disconnectPlayerLocation(){
    console.log('Disconnecting');
    locationData = null;
}