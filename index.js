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
    base: 90,
    min: 3,
    max: 90,
}
const signSize = {
    base: 4,
    min: 0.05,
    max: 2.4
}
const zoomThresholds = [
    {zoom:1, distance:500},
    {zoom:1.25, distance:200},
    {zoom:1.5, distance:130},
    {zoom:2.5, distance:80},
    {zoom:5, distance:40},
    {zoom:20, distance:20},
    {zoom:60, distance:10},
];
const scaleCullThresholds = {
    [1.0]: 500,
    [1.25]: 200,
    [1.5]: 130,
    [2.5]: 80,
    [5]: 40,
    [20]: 20,
    [60]: 10
}

// CODE
const map = document.getElementById('map');
const map_container = document.getElementById('mapContainer');
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

let previousMapScale = -1;

document.addEventListener('DOMContentLoaded', () => {
    loadTrackData('trackdata_dv.json');
    mapScrollSetup();
});

async function loadTrackData(file){
    mapData = await (await fetch(new Request(file))).json();
    establishDimensions();
    fillSvg();
}

/** Handling for the map scrolling and zooming */
function mapScrollSetup(){
    let mapNav = {x:0, y:0, scale:1};
    let prevMouse = {x:0, y:0, scale:1};
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
    map.style.transform = `translate(${-navData.x}px, ${-navData.y}px) scale(${navData.scale})`;
    if(navData.scale !== previousMapScale){
        let dirtyScale = previousMapScale < 0;
        for(const cullThreshold in scaleCullThresholds){
            if(dirtyScale || (previousMapScale < cullThreshold && navData.scale > cullThreshold) || (previousMapScale > cullThreshold && navData.scale < cullThreshold)){
                dirtyScale = true;
                break;
            }
        }
        map_rails.setAttribute('stroke-width', Utils.clamp(trackWidth.base/navData.scale, trackWidth.min, trackWidth.max));
        if(dirtyScale){
            let zoomThresholdStyles = '';
            for(let i=0; i<zoomThresholds.length; i++){
                zoomThresholdStyles += `\n.zoomThreshold_${i}{display:${navData.scale > zoomThresholds[i].zoom ? 'unset' : 'none'}}`;
            }
            map.getElementById('zoomStyle').innerHTML = `
            .sign{
                transform: scale(${Utils.clamp(signSize.base/navData.scale, signSize.min, signSize.max)});
            }${zoomThresholdStyles}
            `;
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
    
    /*updateMapview({
        x: map_container.width/2-map.getAttribute('width')/2,
        y: map_container.height/2-map.getAttribute('height')/2,
        scale: 1
    });*/
    updateMapview();
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
        let grade = Bezier.estimateMaxGrade(bezStart, bezHandle1, bezHandle2, bezEnd, bezierGradeResolution);
        let gradeClass = Utils.gradeToClass(grade);
        let length = Bezier.estimateLength(bezStart, bezHandle1, bezHandle2, bezEnd, bezierLengthResolution);
        let curvature = Bezier.estimateMaxCurvature(bezStart, bezHandle1, bezHandle2, bezEnd, bezierCurvatureResolution);
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

/** Hide extraneous signage, reducing clutter. */
function cleanMarkers(){
    let roughDist = 0;
    for(let i=0; i<markers.length; i++){
        markers[i].crowdingScore = 0;
        markers[i].nearestDist = 100000;
        for(let j=0; j<markers.length; j++){
            if(i != j && markers[i].type == markers[j].type){
                roughDist = Vector.roughDistance(markers[i].position, markers[j].position);
                markers[i].crowdingScore += 1/roughDist;
                if(roughDist < markers[i].nearestDist){
                    markers[i].nearestDist = roughDist;
                    markers[i].nearest = markers[j];
                }
            }
        }
        //let randomZoomThreshold = Utils.randomRange(1, 5);
        //if(randomZoomThreshold < 4) markers[i].skip = true;
        /*
        for(let j=0; j<markers.length; j++){
            if(i != j && !markers[j].skip && markers[i].type == markers[j].type){
                
                if(Vector.isWithinAARange(markers[i].position, markers[j].position, 120)){
                    if(markers[i].type == 'grade'){
                        if(Math.abs(markers[j].value) > Math.abs(markers[i].value)) markers[i].skip = true;
                        else markers[j].skip = true;
                    }else if(markers[i].type == 'speed'){
                        if(markers[j].value > markers[i].value) markers[j].skip = true;
                        else markers[i].skip = true;
                    }
                }
            }
        }*/
    }
}

/** Create the signage */
function drawMarkers(){
    const gradeSigns = document.createElementNS(svgns, 'g');
    gradeSigns.setAttribute('id', 'grade_Signs');
    map_markers.appendChild(gradeSigns);
    const speedSigns = document.createElementNS(svgns, 'g');
    speedSigns.setAttribute('id', 'speed_signs');
    map_markers.appendChild(speedSigns);
    for(const markerData of markers){
        //if(markerData.skip) continue;
        let marker = document.createElementNS(svgns, 'g');
        let markerImg = document.createElementNS(svgns, 'use');
        let title = document.createElementNS(svgns, 'title');
        let text = document.createElementNS(svgns, 'text');
        marker.appendChild(markerImg);
        marker.appendChild(text);
        marker.appendChild(title);
        marker.setAttribute('transform', `translate(${markerData.position.x} ${markerData.position.z})`);
        // Grade signs
        if(markerData.type == 'grade'){
            markerImg.setAttribute('href', '#gradeArrow');
            markerImg.classList.add('sign', 'gradeSign');
            text.classList.add('signText', 'gradeSign');
            if(markerData.class) markerImg.classList.add(markerData.class);
            const tanLen = Math.sqrt(markerData.tangent.x*markerData.tangent.x + markerData.tangent.z*markerData.tangent.z) * Math.sign(markerData.tangent.y);
            const rot = Math.atan2(markerData.tangent.x/tanLen, -markerData.tangent.z/tanLen) * (180/Math.PI);
            marker.setAttribute('transform', `translate(${markerData.position.x} ${markerData.position.z}) rotate(${rot})`);
            text.setAttribute('transform', `rotate(${-rot})`);
            title.innerHTML = `${Math.round(markerData.value*1000)/10}%`;
            text.innerHTML = `${Math.round(markerData.value*1000)/10}`;
            gradeSigns.appendChild(marker);
        // Speed Signs
        }else if(markerData.type == 'speed'){
            markerImg.setAttribute('href', `#speedSign_${Math.round(markerData.value/10)}`);
            markerImg.classList.add('sign', 'speedSign');
            text.classList.add('signText', 'speedSign');
            title.innerHTML = `${Math.round(markerData.value)} km/h`;
            /*let offset = Vector.normalize({x:markerData.tangent.z, y:0, z:-markerData.tangent.x});
            marker.setAttribute('transform', `translate(${markerData.position.x + offset.x*100} ${markerData.position.z + offset.z*50})`);*/
            marker.setAttribute('transform', `translate(${markerData.position.x} ${markerData.position.z})`);
            speedSigns.appendChild(marker);
        }

        for(let i=zoomThresholds.length-1; i>= 0; i--){
            if(markerData.nearestDist < zoomThresholds[i].distance || i==0){
                title.innerHTML += `\n${markerData.nearestDist}`;
                marker.classList.add(`zoomThreshold_${i}`);
                break;
            }
        }
    }
}