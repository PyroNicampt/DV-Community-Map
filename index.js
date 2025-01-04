'use strict';

import * as Vector from './js/vectorlib.js';
import * as Bezier from './js/bezierlib.js';
import * as Utils from './js/utillib.js';
import {Color} from './js/colorlib.js';
import * as Config from './config.js';

// CONFIG
const bezierGradeResolution = 80;
const bezierLengthResolution = 80;
const bezierCurvatureResolution = 80;
const padding = 500;
const zoomFactor = 1.1;
const trackWidth = {
    base: 110,
    min: 3,
    max: 90,
}
const signSize = {
    base: 4,
    min: 0.05,
    max: 1.8
}

const scaleCullBaseDistance = 500;

// Lower values make shorter track sections show their marker further out.
const scaleCullBaseSectionLength = 22;
const scaleCullBaseSectionLengthSpeedboard = 100;

// How long a track section can go without changing before another marker is placed. Increases readability
const maxSectionLength = 700;

// Zoom levels at which different markers get swapped in/out.
const scaleCullThresholds = [
    {scale:1},
    {scale:2},
    {scale:3},
    {scale:6},
    {scale:12},
    {scale:24},
    {scale:60},
];

// CODE
const map = document.getElementById('map');

const map_container = document.getElementById('mapContainer');
let map_container_rect = map_container.getBoundingClientRect();
const resizeObserver = new ResizeObserver(() => {map_container_rect = map_container.getBoundingClientRect();});
resizeObserver.observe(map_container);

const map_navigator = document.getElementById('mapNavigator');
const zoomLevelDisplay = document.getElementById('zoomLevelDisplay');
const zoomStyle = document.getElementById('zoomStyle');
const styleRoot = document.querySelector(':root');
const svgns = map.getAttribute('xmlns');

const map_rails = document.createElementNS(svgns, 'g');
map_rails.setAttribute('id', 'map_rails');
map.appendChild(map_rails);

//const map_markers = document.createElementNS(svgns, 'g');
//map_markers.setAttribute('id', 'map_markers');
//map.appendChild(map_markers);
const map_markers = document.getElementById('mapMarkers');
const poiLayers = {
    container: document.createElementNS(svgns, 'g'),

    stations: document.createElementNS(svgns, 'g'),
    service: document.createElementNS(svgns, 'g'),
    features: document.createElementNS(svgns, 'g'),
    landmarks: document.createElementNS(svgns, 'g')
};

let mapData = [];
let trackNameCounting = {};
let poiData = [];
let tracks = [];
let markers = [];

//let currentMapNav = {};
let mapNav = {};
let previousMapScale = -1;

let MapMatrix = {};

document.addEventListener('DOMContentLoaded', async () => {
    await loadTrackData('trackdata_dv.json');
    await loadPoiData('poi_dv.json');
    mapScrollSetup();
});

async function loadTrackData(file){
    mapData = await (await fetch(new Request(file))).json();
    establishDimensions();
    fillSvg();
}

function filterToTrack(trackName, id=0){
    let idx = 0;
    for(const track of mapData){
        if(track.name == trackName){
            if(idx == id){
                mapData = [track];
                return;
            }
            idx++;
        }
    }
}

async function loadPoiData(file){
    poiData = await (await fetch(new Request(file))).json();

    for(let layerIdx in poiLayers){
        poiLayers[layerIdx].setAttribute('id', 'poi_'+layerIdx);
        if(layerIdx == 'container') continue;
        poiLayers.container.appendChild(poiLayers[layerIdx]);
    }
    map_markers.appendChild(poiLayers.container);

    for(let poi of poiData){
        addPoi(poi);
    }
}

/** Handling for the map scrolling and zooming */
function mapScrollSetup(){
    const touchCache = [];
    let touchCount = 0;
    let pinchDistance = null;
    let previousScale = null;
    const touchDownHandler = e => {
        if(e.button != 0) return;
        if(touchCache.length == 0){
            map_container.style.cursor = 'grabbing';
            document.addEventListener('pointermove', touchMoveHandler);

            document.addEventListener('pointerup', touchUpHandler);
            document.addEventListener('pointercancel', touchUpHandler);
            //document.addEventListener('pointerout', touchUpHandler);
            document.addEventListener('pointerleave', touchUpHandler);
        }
        touchCache[e.pointerId] = {x:e.clientX, y:e.clientY};
        touchCount++;
        if(touchCount == 2){
            pinchDistance = getTouchDistance();
            previousScale = mapNav.scale;
        }
    }
    const touchMoveHandler = e => {
        if(!touchCache[e.pointerId]) return;
        if(touchCount == 1){
            mapNav.x += e.clientX - touchCache[e.pointerId].x;
            mapNav.y += e.clientY - touchCache[e.pointerId].y;
        }else if(touchCount == 2){
            getTouchAverage();
            zoomAtPosition(touchCenter_x, touchCenter_y, (previousScale * getTouchDistance()/pinchDistance)/mapNav.scale);
        }
        touchCache[e.pointerId].x = e.clientX;
        touchCache[e.pointerId].y = e.clientY;
    }
    const touchUpHandler = e => {
        if(!touchCache[e.pointerId]) return;
        touchCache[e.pointerId] = null;
        touchCount--;
        if(touchCount == 0){
            map_container.style.removeProperty('cursor');
        }
    }
    const scrollHandler = e => {
        if(e.deltaY != 0) zoomAtPosition(e.clientX, e.clientY, e.deltaY > 0 ? 1/zoomFactor : zoomFactor);
    }
    const navUpdate = ts => {
        if(ts){
            updateMapview();
        }
        requestAnimationFrame(navUpdate);
    }

    let touchDist_aX = 0;
    let touchDist_aY = 0;
    let touchDist_counter = 0;
    const getTouchDistance = () => {
        touchDist_counter = 0;
        touchDist_aX = 0;
        touchDist_aY = 0;
        for(let touch of touchCache){
            if(touchDist_counter == 0){
                touchDist_aX += touch.x;
                touchDist_aY += touch.y;
            }else{
                touchDist_aX -= touch.x;
                touchDist_aY -= touch.y;
                break;
            }
            touchDist_counter++;
        }
        return Math.sqrt(touchDist_aX*touchDist_aX + touchDist_aY*touchDist_aY);
    };

    let touchCenter_x = 0;
    let touchCenter_y = 0;
    let touchCenter_count = 0;
    const getTouchAverage = () => {
        touchCenter_x = 0;
        touchCenter_y = 0;
        touchCenter_count = 0;
        for(let touch of touchCache){
            touchCenter_x += touch.x;
            touchCenter_y += touch.y;
            touchCenter_count++;
        }
        touchCenter_x /= touchCenter_count;
        touchCenter_y /= touchCenter_count;
    }

    let zoomCursorLocal_x = 0;
    let zoomCursorLocal_y = 0;
    const zoomAtPosition = (x, y, scaleFactor) => {
        zoomCursorLocal_x = x - map_container_rect.left;
        zoomCursorLocal_y = y - map_container_rect.top;
        mapNav.x = zoomCursorLocal_x - scaleFactor * (zoomCursorLocal_x-mapNav.x);
        mapNav.y = zoomCursorLocal_y - scaleFactor * (zoomCursorLocal_y-mapNav.y);
        mapNav.scale *= scaleFactor;
    }
    map_container.addEventListener('pointerdown', touchDownHandler);
    map_container.addEventListener('wheel', scrollHandler);
    navUpdate();
}

/** Readjust map view to focus on position */
function updateMapview(){
    if(mapNav == null) return;
    map_navigator.style.transform = `translate(${mapNav.x}px, ${mapNav.y}px) scale(${mapNav.scale})`;
    if(mapNav.scale !== previousMapScale){
        zoomLevelDisplay.innerHTML = `Zoom: ${Math.round(mapNav.scale*100)/100}x`;
        let dirtyScale = previousMapScale < 0;
        for(const cullThreshold of scaleCullThresholds){
            if(dirtyScale || (previousMapScale < cullThreshold.scale && mapNav.scale > cullThreshold.scale) || (previousMapScale > cullThreshold.scale && mapNav.scale < cullThreshold.scale)){
                dirtyScale = true;
                break;
            }
        }
        map_rails.setAttribute('stroke-width', Utils.clamp(trackWidth.base/mapNav.scale, trackWidth.min, trackWidth.max));
        styleRoot.style.setProperty('--markerScale', 1/mapNav.scale);
        if(dirtyScale){
            let dynamicStyles = [];
            for(let i=0; i<scaleCullThresholds.length; i++){
                if(mapNav.scale >= scaleCullThresholds[i].scale) dynamicStyles.push(`.maxZoomCull_${i}{display:none;}`);
                if(mapNav.scale <= scaleCullThresholds[i].scale) dynamicStyles.push(`.minZoomCull_${i}{display:none;}`);
            }
            zoomStyle.innerHTML = dynamicStyles.join('\n');
        }
        previousMapScale = mapNav.scale;
    }
}

/** Get the bounding box of all the tracks, and set the map bounds accordingly. Also flips the Y axis.
 * **Note:** Does NOT evaluate beziers, uses the control points only.
*/
function establishDimensions(){
    let minX = Infinity;
    let minY = Infinity;
    let minAlt = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxAlt = -Infinity;
    for(const obj of mapData){
        for(const point of obj.points){
            minX = Math.min(minX, point.position.x, point.h1.x, point.h2.x);
            minY = Math.min(minY, point.position.z, point.h1.z, point.h2.z);
            minAlt = Math.min(minAlt, point.position.y, point.h1.y, point.h2.y);
            maxX = Math.max(maxX, point.position.x, point.h1.x, point.h2.x);
            maxY = Math.max(maxY, point.position.z, point.h1.z, point.h2.z);
            maxAlt = Math.max(maxAlt, point.position.y, point.h1.y, point.h2.y);
        }
    }
    let width = maxX-minX;
    let height = maxY-minY;
    MapMatrix = {
        x1: minX,
        x2: maxX,
        y1: minY,
        y2: maxY,
        minAlt: minAlt,
        maxAlt: maxAlt,
        width: width,
        height: height,
        fixY: yIn => {
            return minY+maxY-yIn;
        }
    }
    map.setAttribute('viewBox', `${minX-padding} ${minY-padding} ${width+2*padding} ${height+2*padding}`);
    map_markers.setAttribute('viewBox', map.getAttribute('viewBox'));
    let baseScale = Math.min(map_container.clientWidth/map.clientWidth, map_container.clientHeight/map.clientHeight);
    let isLandscape = map_container.clientWidth > map_container.clientHeight;
    mapNav = {
        x: isLandscape ? -map.clientWidth/2*baseScale + map_container.clientWidth/2 : 0,
        y: isLandscape ? 0 : -map.clientHeight/2*baseScale + map_container.clientHeight/2,
        scale: baseScale
    };
    updateMapview();
    console.log(`(${minX}, ${minY}) to (${maxX}, ${maxY}). Altitude from ${minAlt} to ${maxAlt}`);

    // Flip the z coordinate so the map doesn't display upside-down
    for(const obj of mapData){
        for(const point of obj.points){
            point.position.z = minY+maxY-point.position.z;
            point.h1.z = minY+maxY-point.h1.z;
            point.h2.z = minY+maxY-point.h2.z;
        }
    }
}

/** Populate the SVG data */
function fillSvg(){
    for(const obj of mapData){
        switch(obj.type){
            case 'bezier':
                drawTracks(obj);
                break;
        }
    }
    sortTracks();
    setTrackColorMode('Grade');
    drawMarkers();
}

/** Insert individual rail paths, as well as creating signage data for each path*/
function drawTracks(bezierData){
    if(trackNameCounting[bezierData.name] == null){
        trackNameCounting[bezierData.name] = 0;
    }else{
        trackNameCounting[bezierData.name]++;
    }
    let yardData = /\[(#)\]|\[(Y)\][_-]\[(.*?)\][_-]\[((.*?)[_-]*(.*?)[_-]*(.*?))\]/.exec(bezierData.name);
    if(yardData){
        if(yardData[1]){ // track is [#], thus in yard limits, but not a specific designated yard.
            bezierData.isYard = true;
        }else if(yardData[2]){ // track is [Y], and is a specific yard.
            bezierData.isYard = true;
            bezierData.yardStation = yardData[3]; // Which station the track belongs to
            bezierData.yardDesignation = yardData[4]; // Full yard designation, used on signs
            bezierData.yardName = yardData[5]; // A yard, B yard, C yard, etc.
            bezierData.yardSidingNumber = yardData[6]; // Which siding within the yard
            bezierData.yardUsage = yardData[7]; // Outbound? Parking? Inbound? Loading? That's this.
        }
    }else if(/Turntable Track/.test(bezierData.name)){
        bezierData.isTurntable = true;
    }else if(/\[track (diverging|through)\]/.test(bezierData.name)){
        bezierData.isPoint = true;
    }
    bezierData.randomColor = Color.random();
    for(let i=0; i+1<bezierData.points.length; i++){
        const bezStart = bezierData.points[i].position;
        const bezHandle1 = bezierData.points[i].h2;
        const bezHandle2 = bezierData.points[i+1].h1;
        const bezEnd = bezierData.points[i+1].position;
        bezierData.points[i].element = document.createElementNS(svgns, 'path');
        let genPath = 'M ';
        genPath += `${bezStart.x} ${bezStart.z} `;
        genPath += `C ${bezHandle1.x} ${bezHandle1.z} ${bezHandle2.x} ${bezHandle2.z} ${bezEnd.x} ${bezEnd.z} `;
        bezierData.points[i].grade = Bezier.estimateGrade(bezStart, bezHandle1, bezHandle2, bezEnd, bezierGradeResolution);
        bezierData.points[i].gradeClass = Utils.gradeToClass(bezierData.points[i].grade);
        bezierData.points[i].bezLength = Bezier.estimateLength(bezStart, bezHandle1, bezHandle2, bezEnd, bezierLengthResolution);
        bezierData.points[i].curvature = Bezier.estimateCurvature(bezStart, bezHandle1, bezHandle2, bezEnd, bezierCurvatureResolution);
        bezierData.points[i].postedSpeed = Utils.radiusToSpeed(1/bezierData.points[i].curvature);
        if(bezierData.isYard || bezierData.isTurntable) bezierData.points[i].postedSpeed = Math.min(bezierData.points[i].postedSpeed, 50);
        bezierData.points[i].element.setAttribute('d', genPath);

        bezierData.points[i].element.classList.add('rail');
        //bezierData.points[i].element.setAttribute('stroke', Config.gradeColors[bezierData.points[i].gradeClass ? 'grade_'+bezierData.points[i].gradeClass : 'grade_flat']);
        //bezierData.points[i].element.classList.add(bezierData.points[i].gradeClass != null ? 'grade_'+bezierData.points[i].gradeClass : 'grade_flat');

        //bezierData.points[i].element.setAttribute('stroke', Utils.rgba2hex(bezierData.points[i].grade*50*0,(bezStart.y-113)/(252-113),bezierData.points[i].bezLength*0.01*0,1.0));
        //bezierData.points[i].element.setAttribute('stroke', Utils.rgba2hex((1/bezierData.points[i].curvature) * 100,0,0,1.0));
        //bezierData.points[i].element.setAttribute('stroke', trackCol);
        //bezierData.points[i].element.setAttribute('data-grade', bezierData.points[i].grade);
        //bezierData.points[i].element.setAttribute('data-length', bezierData.points[i].bezLength);
        //bezierData.points[i].element.setAttribute('data-maxradius', 1/bezierData.points[i].curvature);
        bezierData.points[i].randomColor = Color.random();
        tracks.push([(bezStart.y+bezEnd.y)*0.5, bezierData.points[i].element]);

        // Curve tooltip
        let title = document.createElementNS(svgns, 'title');
        title.innerHTML = [
            `"${bezierData.name}"${trackNameCounting[bezierData.name] > 0 ? ' #'+trackNameCounting[bezierData.name] : ''} Sec${i}`,
            `Max Grade: ${Math.round(bezierData.points[i].grade*1000)/10}%`,
            `Min Radius: ${Math.round(1/bezierData.points[i].curvature)} meters`,
            `Top Speed: ${Utils.radiusToSpeed(1/bezierData.points[i].curvature)} km/h`,
            `Length: ${Math.round(bezierData.points[i].bezLength*10)/10} meters`,
            `Altitude: ${Math.round((bezStart.y+bezEnd.y)*0.5)} meters`,
            ].join('\n');
        bezierData.points[i].element.appendChild(title);
    }

    // Add Signage
    let trackZoneData = {};
    let finalSegment = false;
    for(let i=0; i<bezierData.points.length; i++){
        let curSeg = i;
        if(i == bezierData.points.length-1){
            finalSegment = true;
            curSeg--;
        }
        let resetTzdGrade = () => {
            trackZoneData.gradeClass = bezierData.points[i].gradeClass;
            trackZoneData.gradeDirection = Math.sign(bezierData.points[i].grade);
            trackZoneData.gradeCount = 0;
            trackZoneData.gradeSectionLength = 0;
        };
        let resetTzdSpeed = (eb) => {
            trackZoneData.prevSpeed = trackZoneData.speed;
            trackZoneData.speed = bezierData.points[i].postedSpeed;
            trackZoneData.speedCount = 0;
            trackZoneData.speedSectionLength = 0;
        }
        if(i <= 0){
            resetTzdGrade();
            resetTzdSpeed();
        }
        //Grade Signs
        if(trackZoneData.gradeClass != bezierData.points[curSeg].gradeClass || trackZoneData.gradeDirection != Math.sign(bezierData.points[curSeg].grade) || trackZoneData.gradeSectionLength > maxSectionLength || finalSegment){
            if(trackZoneData.gradeClass != 'flat'){
                let offset = Math.floor((trackZoneData.gradeCount+1)/2);
                let center = trackZoneData.gradeCount % 2 ? 0.55 : 0.05;
                let b1 = bezierData.points[i-offset].position;
                let b2 = bezierData.points[i-offset].h2;
                let b3 = bezierData.points[i+1-offset].h1;
                let b4 = bezierData.points[i+1-offset].position;
                let cullLevel = Math.round(scaleCullThresholds.length-1-trackZoneData.gradeSectionLength/scaleCullBaseSectionLength);
                if(bezierData.isYard || bezierData.isTurntable){
                    cullLevel = Math.max(cullLevel, 4);
                }
                markers.push({
                    type: 'grade',
                    value: bezierData.points[i-offset].grade,
                    gradeClass: trackZoneData.gradeClass,
                    position: Bezier.evaluatePoint(b1, b2, b3, b4, center),
                    sectionLength: trackZoneData.gradeSectionLength,
                    sectionCount: trackZoneData.gradeCount,
                    cullLevel: cullLevel,
                    tangent: bezierData.points[i-offset].grade > 0
                        ? Bezier.evaluateVelocity(b1, b2, b3, b4, center)
                        : Bezier.evaluateVelocity(b4, b3, b2, b1, center)
                });
            }
            resetTzdGrade();
        }
        trackZoneData.gradeCount++;
        trackZoneData.gradeSectionLength += bezierData.points[curSeg].bezLength;

        //Speed Signs
        if(trackZoneData.speed != bezierData.points[curSeg].postedSpeed || trackZoneData.speedSectionLength > maxSectionLength || finalSegment){
            let offset = Math.floor((trackZoneData.speedCount+1)/2);
            let center = trackZoneData.speedCount % 2 ? 0.5 : 0.0;
            let b1 = bezierData.points[i-offset].position;
            let b2 = bezierData.points[i-offset].h2;
            let b3 = bezierData.points[i+1-offset].h1;
            let b4 = bezierData.points[i+1-offset].position;
            let cullLevel = Math.round(scaleCullThresholds.length-1-trackZoneData.gradeSectionLength/scaleCullBaseSectionLengthSpeedboard);
            let speedDelta = Math.max(0,
                (bezierData.points[curSeg].postedSpeed != null && bezierData.points[curSeg].postedSpeed < 100) ? bezierData.points[curSeg].postedSpeed-trackZoneData.speed : 0,
                (trackZoneData.prevSpeed != null && trackZoneData.prevSpeed < 100) ? trackZoneData.prevSpeed-trackZoneData.speed : 0
            );
            if(bezierData.points.length == 2 && trackZoneData.speed > 30){
                cullLevel = 6;
            }else if(speedDelta >= 10 && trackZoneData.speed <= 30){
                cullLevel = 0;
            }else if(speedDelta >= 20){
                cullLevel = 1;
            }
            if(bezierData.isYard || bezierData.isTurntable){
                cullLevel = Math.min(cullLevel+1, scaleCullThresholds.length-1);
            }
            markers.push({
                type: 'speed',
                value: trackZoneData.speed,
                position: Bezier.evaluatePoint(b1, b2, b3, b4, center),
                sectionLength: trackZoneData.speedSectionLength,
                sectionCount: trackZoneData.speedCount,
                cullLevel: cullLevel,
                tangent: Bezier.evaluateVelocity(b1, b2, b3, b4, center)
            });
            resetTzdSpeed();
        }
        trackZoneData.speedCount++;
        trackZoneData.speedSectionLength += bezierData.points[curSeg].bezLength;
    }
}

/** Sort the tracks and put them into the svg */
function sortTracks(){
    tracks.sort((a,b) => {
        return a[0]-b[0];
    });
    for(const track of tracks){
        map_rails.appendChild(track[1]);
    }
}

export function setTrackColorMode(mode){
    let modeFunction;
    const keyElement = document.getElementById('legendKeyColors');
    let gradientString = '';
    keyElement.innerHTML = '';
    switch(mode){
        case 'Track Type':
            modeFunction = (section, curve) => {
                let finalColor = '#aaa';
                if(curve.isYard && curve.yardDesignation) finalColor = '#4bf';
                else if(curve.isYard) finalColor = '#4fb';
                else if(curve.isPoint) finalColor = '#fb4';
                else if(curve.isTurntable) finalColor = '#b4f';

                section.element.setAttribute('stroke', finalColor);
            };
            keyElement.innerHTML = `
            <span class="colorKey"><span style="background:#4bf"></span> Designated Yard</span>
            <span class="colorKey"><span style="background:#4fb"></span> Other Yard</span>
            <span class="colorKey"><span style="background:#fb4"></span> Point</span>
            <span class="colorKey"><span style="background:#b4f"></span> Turntable</span>
            <span class="colorKey"><span style="background:#aaa"></span> Other Tracks</span>`;
            break;
        case 'Grade':
            modeFunction = section => {
                section.element.setAttribute('stroke', Config.gradeColors['grade_'+section.gradeClass]);
            };
            for(let grade in Config.gradeColors){
                keyElement.innerHTML += `<span class="colorKey" style="${grade.replace('grade_','') < 6 || grade == 'grade_flat' ? 'color:#000;' : ''}padding:0px 3px;background:${Config.gradeColors[grade]}">${(Utils.classToGrade(grade.replace('grade_',''))*100).toFixed(1)}%</span>`;
            }
            break;
        case 'Altitude':
            modeFunction = section => {
                section.element.setAttribute('stroke', Color.blendGradient(Config.altitudeGradient, (section.position.y-MapMatrix.minAlt)/(MapMatrix.maxAlt-MapMatrix.minAlt)).hex);
            }
            gradientString = 'linear-gradient(to right';
            for(let col of Config.altitudeGradient) gradientString += ', '+col.hex;
            gradientString += ')';
            
            keyElement.innerHTML = `
            <div style="display:flex">
                <div>${Math.floor(MapMatrix.minAlt)}m</div>
                <div class="gradientKey" style="flex-grow:1;background:${gradientString}"></div>
                <div>${Math.ceil(MapMatrix.maxAlt)}m</div>
            </div>
            `;
            break;
        case 'Speed':
            modeFunction = section => {
                section.element.setAttribute('stroke', Color.blendGradient(Config.speedGradient, (section.postedSpeed+10)/110).hex);
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
            modeFunction = (section, curve) => {
                section.element.setAttribute('stroke', curve.randomColor.hex);
            };
            keyElement.innerHTML = 'Random per continuous track section';
            break;
        case 'Curve Random':
            modeFunction = section => {
                section.element.setAttribute('stroke', section.randomColor.hex);
            };
            keyElement.innerHTML = 'Random per individual track bezier curve';
            break;
        default:
            modeFunction = section => {
                section.element.setAttribute('stroke', '#fff');
            };
            break;
    }
    if(modeFunction != null){
        for(let curve of mapData){
            for(let section of curve.points){
                if(!section.element) continue;
                modeFunction(section, curve);
            }
        }
    }
}

/** Create the signage */
function drawMarkers(){
    const signage_container = document.createElementNS(svgns, 'g');
    const gradeSigns = document.createElementNS(svgns, 'g');
    const speedSigns = document.createElementNS(svgns, 'g');

    signage_container.setAttribute('id', 'signage_container');
    gradeSigns.setAttribute('id', 'signage_grade');
    speedSigns.setAttribute('id', 'signage_speed');

    map_markers.appendChild(signage_container);
    signage_container.appendChild(gradeSigns);
    signage_container.appendChild(speedSigns);

    for(const markerData of markers){
        //if(markerData.skip) continue;
        let markerElement = document.createElementNS(svgns, 'g');
        let markerImg = document.createElementNS(svgns, 'use');
        let markerTooltip = document.createElementNS(svgns, 'title');
        markerElement.appendChild(markerImg);
        markerElement.appendChild(markerTooltip);
        markerElement.setAttribute('transform', `translate(${markerData.position.x} ${markerData.position.z})`);
        markerImg.classList.add('fixedScale', 'sign');
        // Grade signs
        if(markerData.type == 'grade'){
            markerImg.classList.add('gradeArrow');
            markerImg.setAttribute('href', '#gradeArrow');
            markerImg.setAttribute('fill', Config.gradeColors['grade_'+markerData.gradeClass]);
            const tanLen = Math.sqrt(markerData.tangent.x*markerData.tangent.x + markerData.tangent.z*markerData.tangent.z) * Math.sign(markerData.tangent.y);
            const rot = Math.atan2(markerData.tangent.x/tanLen, -markerData.tangent.z/tanLen) * (180/Math.PI);
            markerElement.setAttribute('transform', `translate(${markerData.position.x} ${markerData.position.z}) rotate(${rot})`);
            markerTooltip.innerHTML = `${Math.round(markerData.value*1000)/10}% Grade\nSection Length: ${markerData.sectionLength.toFixed(1)} meters\nCovers ${markerData.sectionCount} sections`;
            gradeSigns.appendChild(markerElement);
        // Speed Signs
        }else if(markerData.type == 'speed'){
            markerImg.setAttribute('href', `#speedSign_${Math.round(markerData.value/10)}`);
            markerTooltip.innerHTML = `${Math.round(markerData.value)} km/h\nSection Length: ${markerData.sectionLength.toFixed(1)} meters\nCovers ${markerData.sectionCount} sections`;
            markerElement.setAttribute('transform', `translate(${markerData.position.x} ${markerData.position.z})`);
            speedSigns.appendChild(markerElement);
        }

        if(markerData.debug != null) markerTooltip.innerHTML += '\n'+markerData.debug;

        if(markerData.cullLevel){
            markerElement.classList.add(`minZoomCull_${Math.min(scaleCullThresholds.length-1, markerData.cullLevel)}`);
        }
    }
}

function addPoi(poi, level = 0){
    let poiElement = document.createElementNS(svgns, 'g');
    let poiDisplay = document.createElementNS(svgns, 'g');
    let poiIcon = document.createElementNS(svgns, poi.type == 'station' ? 'text' : 'use');
    let poiTooltip = document.createElementNS(svgns, 'title');
    poiElement.appendChild(poiDisplay);
    poiDisplay.appendChild(poiIcon);
    poiElement.appendChild(poiTooltip);
    poiElement.setAttribute('transform', `translate(${poi.position.x} ${MapMatrix.fixY(poi.position.z)})`);
    poiElement.classList.add('poi');
    poiDisplay.classList.add('fixedScale');
    if(level > 0) poiElement.classList.add('minZoomCull_2');
    switch(poi.type){
        case 'station':
            poiDisplay.classList.add('maxZoomCull_4');
            poiDisplay.classList.remove('fixedScale');
            poiElement.setAttribute('fill', poi.color ?? '#fff');
            poiTooltip.innerHTML = poi.name;
            poiIcon.innerHTML = poi.shorthand;
            poiIcon.setAttribute('style', `font-size:400px; pointer-events:none; stroke:${poi.stroke ?? '#000'}; stroke-width:40px; paint-order:stroke; text-anchor:middle;`);
            let stationName = document.createElementNS(svgns, 'text');
            stationName.innerHTML = poi.nickname ?? poi.name;
            stationName.setAttribute('style', `transform: translate(0px, 120px); font-size:100px; pointer-events:visible; stroke:${poi.stroke ?? '#000'}; stroke-width:20px; paint-order:stroke; text-anchor:middle;`)
            stationName.classList.add('minZoomCull_1');
            poiDisplay.appendChild(stationName);
            poiLayers.stations.prepend(poiElement);
            break;
        case 'office':
            poiIcon.setAttribute('href', '#mrk_office');
            if(poi.military){
                poiDisplay.setAttribute('fill', '#978e47');
                poiTooltip.innerHTML = 'Military Office';
            }else if(poi.museum){
                poiDisplay.setAttribute('fill', '#b44');
                poiTooltip.innerHTML = 'Museum Office';
            }else{
                poiDisplay.setAttribute('fill', '#c4693e');
                poiTooltip.innerHTML = 'Station Office';
            }
            poiLayers.service.prepend(poiElement);
            break;
        case 'coal':
            poiIcon.setAttribute('href', '#mrk_coal');
            poiDisplay.setAttribute('fill', '#202020');
            poiTooltip.innerHTML = 'Coal Tower';
            poiLayers.service.prepend(poiElement);
            break;
        case 'water':
            poiIcon.setAttribute('href', '#mrk_water');
            poiDisplay.setAttribute('fill', '#3fa5ff');
            poiTooltip.innerHTML = 'Water Tower';
            poiLayers.service.prepend(poiElement);
            break;
        case 'garage':
            poiIcon.setAttribute('href', '#mrk_garage');
            poiDisplay.setAttribute('fill', '#8b5dd7');
            poiTooltip.innerHTML = poi.name ?? 'Unknown Garage';
            poiLayers.service.prepend(poiElement);
            poiElement.classList.add('minZoomCull_1');
            break;
        case 'landmark':
            poiIcon.setAttribute('href', '#mrk_landmark');
            poiDisplay.setAttribute('fill', '#af5757');
            poiTooltip.innerHTML = poi.name ?? 'Unknown Landmark';
            poiLayers.landmarks.prepend(poiElement);
            poiElement.classList.add('minZoomCull_1');
            break;
        case 'shop':
            poiIcon.setAttribute('href', '#mrk_shop');
            poiDisplay.setAttribute('fill', '#4f54e9');
            poiTooltip.innerHTML = 'Shop';
            poiLayers.service.prepend(poiElement);
            poiElement.classList.add('minZoomCull_1');
            break;
        case 'service':
            let serviceTypes = [];
            if(poi.repair) serviceTypes.push('Repair');
            if(poi.diesel) serviceTypes.push('Diesel');
            if(poi.charger) serviceTypes.push('Charger');

            if(serviceTypes.length == 0){
                poiIcon.setAttribute('href', '#mrk_service');
                poiDisplay.setAttribute('fill', '#239a96');
                poiTooltip.innerHTML = 'Unknown Service';
            }else{
                poiIcon.setAttribute('href', '#mrk_service_'+serviceTypes[0].toLowerCase());
                poiDisplay.setAttribute('fill', '#239a96');
                let bumpOffset = -200*(serviceTypes.length-1);
                poiIcon.setAttribute('transform', `translate(${bumpOffset} 0)`);
                poiTooltip.innerHTML = serviceTypes[0];
                for(let i=1; i<serviceTypes.length; i++){
                    let subIcon = document.createElementNS(svgns, 'use');
                    subIcon.setAttribute('href', '#mrk_service_'+serviceTypes[i].toLowerCase());
                    subIcon.setAttribute('transform', `translate(${i*400+bumpOffset} 0)`);
                    poiDisplay.appendChild(subIcon);
                    poiTooltip.innerHTML += (i == serviceTypes.length-1 ? (serviceTypes.length == 2 ? ' & ' : ', & ') : ', ')+serviceTypes[i];
                }
                poiTooltip.innerHTML += ' Service';

                if(serviceTypes.length > 1){
                    let bgrect = document.createElementNS(svgns, 'rect');
                    bgrect.setAttribute('width', 400*(serviceTypes.length-1));
                    bgrect.setAttribute('height', 400);
                    bgrect.setAttribute('transform', `translate(${-200*(serviceTypes.length-1)} -200)`);
                    poiDisplay.prepend(bgrect);
                }
            }
            poiLayers.service.prepend(poiElement);
            break;
    }
    if(poi.children){
        for(let child of poi.children){
            addPoi(child, level+1);
        }
    }
}