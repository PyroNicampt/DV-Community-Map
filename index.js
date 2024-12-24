'use strict';

import * as Vector from './js/vectorlib.js';
import * as Bezier from './js/bezierlib.js';
import * as Utils from './js/utillib.js';

// CONFIG
const bezierGradeResolution = 80;
const bezierLengthResolution = 80;
const bezierCurvatureResolution = 80;
const padding = 500;
const zoomFactor = 1.2;
const trackWidth = {
    base: 110,
    min: 3,
    max: 90,
}
const signSize = {
    base: 4,
    min: 0.05,
    max: 2.4
}

const scaleCullBaseDistance = 500;
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
const zoomLevelDisplay = document.getElementById('zoomLevelDisplay');
const styleRoot = document.querySelector(':root');
const svgns = map.getAttribute('xmlns');

const map_rails = document.createElementNS(svgns, 'g');
map_rails.setAttribute('id', 'map_rails');
map.appendChild(map_rails);

const map_markers = document.createElementNS(svgns, 'g');
map_markers.setAttribute('id', 'map_markers');
map.appendChild(map_markers);

let mapData = [];
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
    let scrollDat = {ticking:false};
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

        updateMapview(mapNav);

        prevMouse.x = e.clientX;
        prevMouse.y = e.clientY;
    };
    const mouseUpHandler = () => {
        map_container.style.removeProperty('cursor');
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
    };
    const zoomHandler = e => {
        if(!scrollDat.ticking){
            scrollDat.ticking = true;
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
            updateMapview(mapNav);

            setTimeout(() => {
                scrollDat.ticking = false;
            }, 20);
        }
    };

    map_container.addEventListener('mousedown', mouseDownHandler);
    map_container.addEventListener('wheel', zoomHandler);
}

/** Readjust map view to focus on position */
function updateMapview(navData = {x:0, y:0, scale:1}){
    currentMapNav = navData;
    map.style.transform = `translate(${-navData.x}px, ${-navData.y}px) scale(${navData.scale})`;
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
            minX = Math.min(minX, point[0].x, point[1].x, point[2].x);
            minY = Math.min(minY, point[0].z, point[1].z, point[2].z);
            minAlt = Math.min(minAlt, point[0].y, point[1].y, point[2].y);
            maxX = Math.max(maxX, point[0].x, point[1].x, point[2].x);
            maxY = Math.max(maxY, point[0].z, point[1].z, point[2].z);
            maxAlt = Math.max(maxAlt, point[0].y, point[1].y, point[2].y);
        }
    }
    let width = maxX-minX;
    let height = maxY-minY;
    map.setAttribute('viewBox', `${minX-padding} ${minY-padding} ${width+2*padding} ${height+2*padding}`);
    updateMapview({
        x: map.clientWidth/2-map_container.clientWidth/2,
        y: map.clientHeight/2-map_container.clientHeight/2,
        scale: 1
    });
    console.log(`(${minX}, ${minY}) to (${maxX}, ${maxY}). Altitude from ${minAlt} to ${maxAlt}`);

    // Flip the z coordinate so the map doesn't display upside-down
    for(const obj of mapData){
        for(const point of obj.points){
            point[0].z = minY+maxY-point[0].z;
            point[1].z = minY+maxY-point[1].z;
            point[2].z = minY+maxY-point[2].z;
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
    cleanMarkers();
    drawMarkers();
}

/** Insert individual rail paths, as well as creating signage data for each path*/
function drawTracks(bezierData){
    const trackCol = Utils.rgba2hex(Math.random(),Math.random(),Math.random(),1.0);
    for(let i=0; i+1<bezierData.points.length; i++){
        const bezStart = bezierData.points[i][0];
        const bezHandle1 = bezierData.points[i][2];
        const bezHandle2 = bezierData.points[i+1][1];
        const bezEnd = bezierData.points[i+1][0];
        let newBezier = document.createElementNS(svgns, 'path');
        let genPath = 'M ';
        genPath += `${bezStart.x} ${bezStart.z} `;
        genPath += `C ${bezHandle1.x} ${bezHandle1.z} ${bezHandle2.x} ${bezHandle2.z} ${bezEnd.x} ${bezEnd.z} `;
        let grade = Bezier.estimateGrade(bezStart, bezHandle1, bezHandle2, bezEnd, bezierGradeResolution);
        let gradeClass = Utils.gradeToClass(grade);
        let length = Bezier.estimateLength(bezStart, bezHandle1, bezHandle2, bezEnd, bezierLengthResolution);
        let curvature = Bezier.estimateCurvature(bezStart, bezHandle1, bezHandle2, bezEnd, bezierCurvatureResolution);
        newBezier.setAttribute('d', genPath);

        newBezier.classList.add('rail');
        newBezier.classList.add(gradeClass ?? 'grade_flat');

        //newBezier.setAttribute('stroke', Utils.rgba2hex(grade*50*0,(bezStart.y-113)/(252-113),length*0.01*0,1.0));
        //newBezier.setAttribute('stroke', Utils.rgba2hex((1/curvature) * 100,0,0,1.0));
        //newBezier.setAttribute('stroke', trackCol);
        //newBezier.setAttribute('data-grade', grade);
        //newBezier.setAttribute('data-length', length);
        //newBezier.setAttribute('data-maxradius', 1/curvature);
        tracks.push([(bezStart.y+bezEnd.y)*0.5, newBezier]);

        // Curve tooltip
        let title = document.createElementNS(svgns, 'title');
        title.innerHTML = [
            `"${bezierData.name}"`,
            `Max Grade: ${Math.round(grade*1000)/10}%`,
            `Min Radius: ${Math.round(1/curvature)} meters`,
            `Top Speed: ${Utils.radiusToSpeed(1/curvature)} km/h`,
            `Length: ${Math.round(length*10)/10} meters`,
            `Altitude: ${Math.round((bezStart.y+bezEnd.y)*0.5)} meters`,
            ].join('\n');
        newBezier.appendChild(title);
        
        // Add Signage
        if(grade > 0.001){
            markers.push({
                type: 'grade',
                value: grade,
                class: gradeClass,
                position: Bezier.evaluatePoint(bezStart, bezHandle1, bezHandle2, bezEnd, 0.5),
                tangent: grade > 0
                    ?
                    Bezier.evaluateVelocity(bezStart, bezHandle1, bezHandle2, bezEnd, 0.5)
                    :
                    Bezier.evaluateVelocity(bezEnd, bezHandle2, bezHandle1,bezStart, 0.5)
            });
        }
        markers.push({
            type: 'speed',
            value: Utils.radiusToSpeed(1/curvature),
            position: Bezier.evaluatePoint(bezStart, bezHandle1, bezHandle2, bezEnd, 0.5),
            tangent: Bezier.evaluateVelocity(bezStart, bezHandle1, bezHandle2, bezEnd, 0.5)
        });
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

/** Assign signage to cull at certain zoom levels, reducing clutter and lag. */
function cleanMarkers(){
    let roughDist = 0;
    for(let i=0; i<markers.length; i++){
        markers[i].nearestDistance = Infinity;
        for(let j=0; j<markers.length; j++){
            if(i != j && markers[i].type == markers[j].type){
                roughDist = Vector.roughDistance(markers[i].position, markers[j].position);
                if(markers[i].nearestDistance > roughDist){
                    markers[i].nearestDistance = roughDist;
                    markers[i].nearestMarker = markers[j];
                }
            }
        }
        markers[i].cullLevel = 3;
        for(let cullIndex=0; cullIndex<scaleCullThresholds.length; cullIndex++){

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
            if(markerData.class) markerImg.classList.add(markerData.class);
            const tanLen = Math.sqrt(markerData.tangent.x*markerData.tangent.x + markerData.tangent.z*markerData.tangent.z) * Math.sign(markerData.tangent.y);
            const rot = Math.atan2(markerData.tangent.x/tanLen, -markerData.tangent.z/tanLen) * (180/Math.PI);
            marker.setAttribute('transform', `translate(${markerData.position.x} ${markerData.position.z}) rotate(${rot})`);
            title.innerHTML = `${Math.round(markerData.value*1000)/10}%`;
            gradeSigns.appendChild(marker);
        // Speed Signs
        }else if(markerData.type == 'speed'){
            markerImg.setAttribute('href', `#speedSign_${Math.round(markerData.value/10)}`);
            markerImg.classList.add('sign', 'speedSign');
            title.innerHTML = `${Math.round(markerData.value)} km/h`;
            /*let offset = Vector.normalize({x:markerData.tangent.z, y:0, z:-markerData.tangent.x});
            marker.setAttribute('transform', `translate(${markerData.position.x + offset.x*100} ${markerData.position.z + offset.z*50})`);*/
            marker.setAttribute('transform', `translate(${markerData.position.x} ${markerData.position.z})`);
            speedSigns.appendChild(marker);
        }

        if(markerData.cullLevel) marker.classList.add(`cullThreshold_${markerData.cullLevel}`);
    }
}