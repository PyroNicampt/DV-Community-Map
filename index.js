'use strict';

import * as Vector from './js/vectorlib.js';
import * as Bezier from './js/bezierlib.js';
import * as Utils from './js/utillib.js';
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
const map_navigator = document.getElementById('mapNavigator');
const zoomLevelDisplay = document.getElementById('zoomLevelDisplay');
const styleRoot = document.querySelector(':root');
const svgns = map.getAttribute('xmlns');

const map_rails = document.createElementNS(svgns, 'g');
map_rails.setAttribute('id', 'map_rails');
map.appendChild(map_rails);

//const map_markers = document.createElementNS(svgns, 'g');
//map_markers.setAttribute('id', 'map_markers');
//map.appendChild(map_markers);
const map_markers = document.getElementById('mapMarkers');

let mapData = [];
let trackNameCounting = {};
let poiData = [];
let tracks = [];
let markers = [];

let currentMapNav = {};
let previousMapScale = -1;

document.addEventListener('DOMContentLoaded', async () => {
    await loadTrackData('trackdata_dv.json');
    mapScrollSetup();
});

async function loadTrackData(file){
    mapData = await (await fetch(new Request(file))).json();
    establishDimensions();
    fillSvg();
}

/** Handling for the map scrolling and zooming */
function mapScrollSetup(){
    let mapNav = {x:currentMapNav.x, y:currentMapNav.y, scale:currentMapNav.scale};
    let prevMouse = {x:mapNav.x, y:mapNav.y, scale:mapNav.scale};
    const mouseDownHandler = e => {
        map_container.style.cursor = 'grabbing';
        prevMouse.x = e.clientX;
        prevMouse.y = e.clientY;

        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
    };
    const mouseMoveHandler = e => {
        mapNav.x += prevMouse.x-e.clientX;
        mapNav.y += prevMouse.y-e.clientY;

        prevMouse.x = e.clientX;
        prevMouse.y = e.clientY;
    };
    const mouseUpHandler = () => {
        map_container.style.removeProperty('cursor');
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
    };
    const zoomHandler = e => {
        let rect = map_container.getBoundingClientRect();
        let cursorLocal = {
            x: -e.clientX - rect.left,
            y: -e.clientY - rect.top
        };
        let scaleMult = 1;
        if(e.deltaY < 0){
            scaleMult = zoomFactor;
        }else if(e.deltaY > 0){
            scaleMult = 1/zoomFactor;
        }
        mapNav.x = cursorLocal.x - scaleMult * (cursorLocal.x-mapNav.x);
        mapNav.y = cursorLocal.y - scaleMult * (cursorLocal.y-mapNav.y);
        mapNav.scale *= scaleMult;
    };

    let prevMapNav = {};
    const navUpdate = () => {
        if(prevMapNav.x != currentMapNav.x || prevMapNav.y != currentMapNav.y || prevMapNav.scale != currentMapNav.scale){
            updateMapview(mapNav);
            prevMapNav.x = currentMapNav.x;
            prevMapNav.y = currentMapNav.y;
            prevMapNav.scale = currentMapNav.scale;
        }
        requestAnimationFrame(navUpdate);
    }

    map_container.addEventListener('mousedown', mouseDownHandler);
    map_container.addEventListener('wheel', zoomHandler);
    navUpdate();
}

/** Readjust map view to focus on position */
function updateMapview(navData = {x:0, y:0, scale:1}){
    currentMapNav = navData;
    map_navigator.style.transform = `translate(${-navData.x}px, ${-navData.y}px) scale(${navData.scale})`;
    if(navData.scale !== previousMapScale){
        zoomLevelDisplay.innerHTML = `Zoom: ${Math.round(navData.scale*100)/100}x`;
        let dirtyScale = previousMapScale < 0;
        for(const cullThreshold of scaleCullThresholds){
            if(dirtyScale || (previousMapScale < cullThreshold.scale && navData.scale > cullThreshold.scale) || (previousMapScale > cullThreshold.scale && navData.scale < cullThreshold.scale)){
                dirtyScale = true;
                break;
            }
        }
        map_rails.setAttribute('stroke-width', Utils.clamp(trackWidth.base/navData.scale, trackWidth.min, trackWidth.max));
        styleRoot.style.setProperty('--signScale', Utils.clamp(signSize.base/navData.scale, signSize.min, signSize.max));
        if(dirtyScale){
            for(let i=0; i<scaleCullThresholds.length; i++){
                styleRoot.style.setProperty(`--cullThreshold_state_${i}`, navData.scale >= scaleCullThresholds[i].scale ? 'initial' : 'none')
            }
        }
        previousMapScale = navData.scale;
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
    map.setAttribute('viewBox', `${minX-padding} ${minY-padding} ${width+2*padding} ${height+2*padding}`);
    map_markers.setAttribute('viewBox', map.getAttribute('viewBox'));
    updateMapview({
        x: map.clientWidth/2-map_container.clientWidth/2,
        y: map.clientHeight/2-map_container.clientHeight/2,
        scale: 1
    });
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
    setTrackColorMode();
    drawMarkers();
}

/** Insert individual rail paths, as well as creating signage data for each path*/
function drawTracks(bezierData){
    const trackCol = Utils.rgba2hex(Math.random(),Math.random(),Math.random(),1.0);
    if(trackNameCounting[bezierData.name] == null){
        trackNameCounting[bezierData.name] = 0;
    }else{
        trackNameCounting[bezierData.name]++;
    }
    let yardData = /\[(#)\]|\[(Y)\]_\[(.*?)\]_\[((.*?)-(.*?)-(.*?))\]/.exec(bezierData.name);
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
    for(let i=0; i+1<bezierData.points.length; i++){
        let newBezier = document.createElementNS(svgns, 'path');
        const bezStart = bezierData.points[i].position;
        const bezHandle1 = bezierData.points[i].h2;
        const bezHandle2 = bezierData.points[i+1].h1;
        const bezEnd = bezierData.points[i+1].position;
        let genPath = 'M ';
        genPath += `${bezStart.x} ${bezStart.z} `;
        genPath += `C ${bezHandle1.x} ${bezHandle1.z} ${bezHandle2.x} ${bezHandle2.z} ${bezEnd.x} ${bezEnd.z} `;
        bezierData.points[i].grade = Bezier.estimateGrade(bezStart, bezHandle1, bezHandle2, bezEnd, bezierGradeResolution);
        bezierData.points[i].gradeClass = Utils.gradeToClass(bezierData.points[i].grade);
        bezierData.points[i].bezLength = Bezier.estimateLength(bezStart, bezHandle1, bezHandle2, bezEnd, bezierLengthResolution);
        bezierData.points[i].curvature = Bezier.estimateCurvature(bezStart, bezHandle1, bezHandle2, bezEnd, bezierCurvatureResolution);
        bezierData.points[i].postedSpeed = Utils.radiusToSpeed(1/bezierData.points[i].curvature);
        newBezier.setAttribute('d', genPath);
        if(bezierData.isYard || bezierData.isTurntable) bezierData.points[i].postedSpeed = Math.min(bezierData.points[i].postedSpeed, 50);

        bezierData.points[i].element.classList.add('rail');
        //bezierData.points[i].element.setAttribute('stroke', Config.gradeColors[bezierData.points[i].gradeClass ? 'grade_'+bezierData.points[i].gradeClass : 'grade_flat']);
        //bezierData.points[i].element.classList.add(bezierData.points[i].gradeClass != null ? 'grade_'+bezierData.points[i].gradeClass : 'grade_flat');

        //newBezier.setAttribute('stroke', Utils.rgba2hex(bezierData.points[i].grade*50*0,(bezStart.y-113)/(252-113),bezierData.points[i].bezLength*0.01*0,1.0));
        //newBezier.setAttribute('stroke', Utils.rgba2hex((1/bezierData.points[i].curvature) * 100,0,0,1.0));
        //newBezier.setAttribute('stroke', trackCol);
        //newBezier.setAttribute('data-grade', bezierData.points[i].grade);
        //newBezier.setAttribute('data-length', bezierData.points[i].bezLength);
        //newBezier.setAttribute('data-maxradius', 1/bezierData.points[i].curvature);
        tracks.push([(bezStart.y+bezEnd.y)*0.5, newBezier]);

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
        newBezier.appendChild(title);
    }

    // Add Signage
    let trackZoneData = {};
    for(let i=0; i+1<bezierData.points.length; i++){
        for(let zI=0; zI < ((i == bezierData.points.length-2) ? 2 : 1); zI++){
            let resetTzdGrade = () => {
                trackZoneData.gradeClass = bezierData.points[i].gradeClass;
                trackZoneData.gradeDirection = Math.sign(bezierData.points[i].grade);
                trackZoneData.gradeCount = 0;
                trackZoneData.gradeSectionLength = bezierData.points[i].bezLength;
            };
            let resetTzdSpeed = () => {
                trackZoneData.prevSpeed = trackZoneData.speed;
                trackZoneData.speed = bezierData.points[i].postedSpeed;
                trackZoneData.speedCount = 0;
                trackZoneData.speedSectionLength = bezierData.points[i].bezLength;
            }
            if(i <= 0){
                resetTzdGrade();
                resetTzdSpeed();
            }else{
                //Grade Signs
                if(trackZoneData.gradeClass != bezierData.points[i].gradeClass || trackZoneData.gradeDirection != Math.sign(bezierData.points[i].grade) || trackZoneData.gradeSectionLength > maxSectionLength || zI > 0){
                    if(trackZoneData.gradeClass != 'flat'){
                        let offset = Math.floor((trackZoneData.gradeCount+1)/2)+1;
                        let center = trackZoneData.gradeCount % 2 ? 1 : 0.5;
                        let b1 = bezierData.points[(i+zI)-offset].position;
                        let b2 = bezierData.points[(i+zI)-offset].h2;
                        let b3 = bezierData.points[(i+zI)+1-offset].h1;
                        let b4 = bezierData.points[(i+zI)+1-offset].position;
                        markers.push({
                            type: 'grade',
                            value: bezierData.points[(i+zI)-offset].grade,
                            gradeClass: trackZoneData.gradeClass,
                            position: Bezier.evaluatePoint(b1, b2, b3, b4, center),
                            sectionLength: trackZoneData.gradeSectionLength,
                            cullLevel: Math.round(scaleCullThresholds.length-1-trackZoneData.gradeSectionLength/scaleCullBaseSectionLength),
                            tangent: bezierData.points[(i+zI)].grade > 0
                                ? Bezier.evaluateVelocity(b1, b2, b3, b4, center)
                                : Bezier.evaluateVelocity(b4, b3, b2, b1, center)
                        });
                    }
                    resetTzdGrade();
                }else{
                    trackZoneData.gradeCount++;
                    trackZoneData.gradeSectionLength += bezierData.points[i].bezLength;
                }
                //Speed Signs
                if(trackZoneData.speed != bezierData.points[i].postedSpeed || trackZoneData.speedSectionLength > maxSectionLength || zI > 0){
                    let offset = Math.floor((trackZoneData.speedCount+1)/2)+1;
                    let center = trackZoneData.speedCount % 2 ? 0.75 : 0.25;
                    let b1 = bezierData.points[(i+zI)-offset].position;
                    let b2 = bezierData.points[(i+zI)-offset].h2;
                    let b3 = bezierData.points[(i+zI)+1-offset].h1;
                    let b4 = bezierData.points[(i+zI)+1-offset].position;
                    let cullLevel = Math.round(scaleCullThresholds.length-1-trackZoneData.gradeSectionLength/scaleCullBaseSectionLengthSpeedboard);
                    let speedDelta = Math.max(0,
                        (bezierData.points[i].postedSpeed != null && bezierData.points[i].postedSpeed < 100) ? bezierData.points[i].postedSpeed-trackZoneData.speed : 0,
                        (trackZoneData.prevSpeed != null && trackZoneData.prevSpeed < 100) ? trackZoneData.prevSpeed-trackZoneData.speed : 0
                    );
                    if(speedDelta >= 10 && trackZoneData.speed <= 30){
                        cullLevel = 0;
                    }else if(speedDelta >= 20){
                        cullLevel = 1;
                    }
                    markers.push({
                        type: 'speed',
                        value: trackZoneData.speed,
                        position: Bezier.evaluatePoint(b1, b2, b3, b4, center),
                        sectionLength: trackZoneData.speedSectionLength,
                        cullLevel: cullLevel,
                        tangent: Bezier.evaluateVelocity(b1, b2, b3, b4, center)
                    });
                    resetTzdSpeed();
                }else{
                    trackZoneData.speedCount++;
                    trackZoneData.speedSectionLength += bezierData.points[i].bezLength;
                }
            }
        }
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

function setTrackColorMode(mode){
    let modeFunction = null;
    switch(mode){
        
        default:
            modeFunction = section => {
                if(!section.element) return;
                section.element.setAttribute('stroke', Config.gradeColors['grade_'+section.gradeClass]);
            };
            break;
    }
    if(modeFunction !== null){
        for(let curve of mapData){
            for(let section of curve.points){
                modeFunction(section);
            }
        }
    }
}

/** Create the signage */
function drawMarkers(){
    const gradeSigns = document.createElementNS(svgns, 'g');
    gradeSigns.setAttribute('id', 'grade_signs');
    map_markers.appendChild(gradeSigns);
    const speedSigns = document.createElementNS(svgns, 'g');
    speedSigns.setAttribute('id', 'speed_signs');
    map_markers.appendChild(speedSigns);
    for(const markerData of markers){
        //if(markerData.skip) continue;
        let marker = document.createElementNS(svgns, 'g');
        let markerImg = document.createElementNS(svgns, 'use');
        let title = document.createElementNS(svgns, 'title');
        marker.appendChild(markerImg);
        marker.appendChild(title);
        marker.setAttribute('transform', `translate(${markerData.position.x} ${markerData.position.z})`);
        // Grade signs
        if(markerData.type == 'grade'){
            markerImg.setAttribute('href', '#gradeArrow');
            markerImg.classList.add('sign', 'gradeSign');
            markerImg.setAttribute('fill', Config.gradeColors['grade_'+markerData.gradeClass])
            const tanLen = Math.sqrt(markerData.tangent.x*markerData.tangent.x + markerData.tangent.z*markerData.tangent.z) * Math.sign(markerData.tangent.y);
            const rot = Math.atan2(markerData.tangent.x/tanLen, -markerData.tangent.z/tanLen) * (180/Math.PI);
            marker.setAttribute('transform', `translate(${markerData.position.x} ${markerData.position.z}) rotate(${rot})`);
            title.innerHTML = `${Math.round(markerData.value*1000)/10}% Grade\nSection Length: ${markerData.sectionLength.toFixed(1)} meters`;
            gradeSigns.appendChild(marker);
        // Speed Signs
        }else if(markerData.type == 'speed'){
            markerImg.setAttribute('href', `#speedSign_${Math.round(markerData.value/10)}`);
            markerImg.classList.add('sign', 'speedSign');
            title.innerHTML = `${Math.round(markerData.value)} km/h\nSection Length: ${markerData.sectionLength.toFixed(1)} meters`;
            /*let offset = Vector.normalize({x:markerData.tangent.z, y:0, z:-markerData.tangent.x});
            marker.setAttribute('transform', `translate(${markerData.position.x + offset.x*100} ${markerData.position.z + offset.z*50})`);*/
            marker.setAttribute('transform', `translate(${markerData.position.x} ${markerData.position.z})`);
            speedSigns.appendChild(marker);
        }

        if(markerData.cullLevel){
            marker.classList.add(`cullThreshold_${Math.min(scaleCullThresholds.length-1, markerData.cullLevel)}`);
        }
    }
}