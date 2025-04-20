'use strict';

import * as Vector from './js/vectorlib.js';
import * as Bezier from './js/bezierlib.js';
import * as Utils from './js/utillib.js';
import {Color} from './js/colorlib.js';
import * as Config from './config.js';
import * as MapData from './js/mapdata.js';
import * as Legend from './legend.js';

const mapContainer = document.getElementById('mapContainer');
const mapCanvas = document.getElementById('mapCanvas');
/** The main map drawing context.
 * @type {CanvasRenderingContext2D} */
const mapctx = mapCanvas.getContext('2d');
const mapSprites = document.getElementById('mapSprites');
const mapTerrain = document.getElementById('mapTerrain');
const zoomLevelDisplay = document.getElementById('zoomLevelDisplay');

let isNavigating = false;

document.addEventListener('DOMContentLoaded', async () => {
    await loadShopData('shop_items.json');
    await loadTrackData('trackdata_dv.json');
    await loadPoiData('poi_dv.json');
    MapData.sortMarkers();

    Utils.generateGradeArrows();

    MapData.matrix.initialize();
    MapData.view.initialize();
    redrawMap();
    mapNavigationSetup();
    Legend.initialize();
    tooltipSetup();
});

window.addEventListener('resize', () => {MapData.view.dirty = true});

/** Handling for the map scrolling and zooming */
function mapNavigationSetup(){
    let touchCache = [];
    let touchCount = 0;
    let pinchDistance = null;
    let previousScale = null;
    const touchDownHandler = e => {
        if(e.button != 0) return;
        if(touchCache.length == 0){
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
            previousScale = MapData.view.scale;
        }
        mapContainer.style.cursor = 'grabbing';
    }
    const touchMoveHandler = e => {
        if(!touchCache[e.pointerId]){
            touchCache = [];
            return;
        }
        if(touchCount == 1){
            MapData.view.x += e.clientX - touchCache[e.pointerId].x;
            MapData.view.y -= e.clientY - touchCache[e.pointerId].y;
        }else if(touchCount == 2){
            getTouchAverage();
            zoomAtPosition(touchCenter_x, touchCenter_y, (previousScale * getTouchDistance()/pinchDistance)/MapData.view.scale);
        }else{
            touchCache = [];
            MapData.view.dirty = true;
            return;
        }
        isNavigating = true;
        touchCache[e.pointerId].x = e.clientX;
        touchCache[e.pointerId].y = e.clientY;
        MapData.view.dirty = true;
    }
    const touchUpHandler = e => {
        if(!touchCache[e.pointerId]) return;
        touchCache[e.pointerId] = null;
        touchCount--;
        if(touchCount <= 0){
            mapContainer.style.cursor = '';
        }
    }
    const scrollHandler = e => {
        if(e.deltaY != 0) zoomAtPosition(e.clientX, e.clientY, e.deltaY > 0 ? 1/Config.scrollZoomFactor : Config.scrollZoomFactor);
    }
    const navButtonInput = navType => {
        const centerX = mapContainer.offsetWidth / 2;
        const centerY = mapContainer.offsetHeight / 2;
        switch(navType){
            case 'zoomIn':
                zoomAtPosition(centerX, centerY, Config.buttonZoomFactor);
                break;
            case 'zoomOut':
                zoomAtPosition(centerX, centerY, 1/Config.buttonZoomFactor);
                break;
        }
    }
    
    const navUpdate = ts => {
        if(ts && MapData.view.dirty){
            redrawMap();
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
        if(MapData.view.scale * scaleFactor > Config.maxZoomLevel || MapData.view.scale * scaleFactor < Config.minZoomLevel){
            MapData.view.dirty = false;
            return;
        }
        MapData.view.x = x - scaleFactor * (x - MapData.view.x);
        MapData.view.y = -y - scaleFactor * (-y - MapData.view.y);
        MapData.view.scale *= scaleFactor;
        MapData.view.dirty = true;
    }
	
    mapContainer.addEventListener('pointerdown', touchDownHandler);
    mapContainer.addEventListener('wheel', scrollHandler);

    document.getElementById('navZoomIn').addEventListener('click', e => {navButtonInput('zoomIn');});
    document.getElementById('navZoomOut').addEventListener('click', e => {navButtonInput('zoomOut');});
    navUpdate();
}

function tooltipSetup(){
    const tooltip = document.getElementById('tooltip');
    const cursorCoordDisplay = document.getElementById('cursorCoordDisplay');
    let tooltipX = 0;
    let tooltipY = 0;
    let tooltipDirty = false;
    let removeTooltip = false;

    mapContainer.addEventListener('mousemove', event => {
        tooltipX = event.clientX;
        tooltipY = event.clientY;
        removeTooltip = false;
        tooltipDirty = true;
    });
    mapContainer.addEventListener('mouseleave', event => {
        removeTooltip = true;
        tooltipDirty = true;
    });

    const tooltipUpdate = ts => {
        if(ts && tooltipDirty){
            let tooltipContents = MapData.testTooltip(tooltipX, tooltipY);
            if(tooltipContents != '' && !removeTooltip && !isNavigating){
                tooltip.innerHTML = tooltipContents.replaceAll('\n','<br>');
                let tooltipWidth = tooltip.clientWidth;
                let tooltipHeight = tooltip.clientHeight;
                tooltipX += 5;
                tooltipY += 5;
                if(tooltipWidth+tooltipX + 10 > mapContainer.clientWidth)
                    tooltipX -= tooltipWidth + 15;
                if(tooltipHeight+tooltipY + 10 > mapContainer.clientHeight)
                    tooltipY -= tooltipHeight + 10;
                tooltip.style.transform = `translate(${tooltipX}px, ${tooltipY}px)`;
                tooltip.style.display = '';
                mapCanvas.style.cursor = 'crosshair';
            }else{
                tooltip.style.display = 'none';
                mapCanvas.style.cursor = '';
            }
            isNavigating = false;
            tooltipDirty = false;
        }
        cursorCoordDisplay.innerHTML = `X: ${MapData.view.unconvertX(tooltipX).toFixed(2)} / Z: ${MapData.view.unconvertY(tooltipY).toFixed(2)}`;
        requestAnimationFrame(tooltipUpdate);
    }
    tooltipUpdate();
}

async function loadTrackData(file){
    let mapData = await (await fetch(new Request(file))).json();

    for(const trackItem of mapData){
        switch(trackItem.type){
            case 'bezier':
                MapData.addTrack(trackItem);
                break;
            case 'junction':
                MapData.addJunction(trackItem);
                break;
            default:
                console.log(`Unknown type "${trackItem.type}"`);
                break;
        }
    }

    MapData.sortTracks();
    MapData.generateTrackSignage();
}

async function loadPoiData(file){
    let poiData = await (await fetch(new Request(file))).json();
    for(let poi of poiData){
        MapData.addPoi(poi);
    }
}

async function loadShopData(file) {
    let shopData = await (await fetch(new Request(file))).json();
    for(let item of shopData){
        MapData.addShopItem(item);
    }
    MapData.sortShops();
}


let railTrack = {};
let curve = {};
function redrawMap(){
    MapData.view.pixelRatio = window.devicePixelRatio;
    mapCanvas.width = mapContainer.clientWidth * MapData.view.pixelRatio;
    mapCanvas.height = mapContainer.clientHeight * MapData.view.pixelRatio;
    zoomLevelDisplay.innerHTML = `Zoom: ${(MapData.view.scale*MapData.view.pixelRatio).toFixed(3)}x / ${(1/(MapData.view.scale*MapData.view.pixelRatio)).toFixed(2)} m/px`;

    if(MapData.layers.terrain){
        mapctx.drawImage(
            mapTerrain,
            MapData.view.convertX(0),
            MapData.view.convertY(16384),
            16384 * MapData.view.scale * MapData.view.pixelRatio,
            16384 * MapData.view.scale * MapData.view.pixelRatio
        );
    }
    // Game gauge is 1.5 meter
    const trackWidth = Math.min(Math.max(6, MapData.view.scale * 1.5), MapData.view.scale * 100) * MapData.view.pixelRatio;
    mapctx.lineWidth = trackWidth;

    for(const railTrack of MapData.railTracks){
        for(const curve of railTrack.curves){
            mapctx.beginPath();
            mapctx.moveTo(MapData.view.convertX(curve.start.x), MapData.view.convertY(curve.start.z));
            mapctx.bezierCurveTo(
                MapData.view.convertX(curve.h1.x),
                MapData.view.convertY(curve.h1.z),
                MapData.view.convertX(curve.h2.x),
                MapData.view.convertY(curve.h2.z),
                MapData.view.convertX(curve.end.x),
                MapData.view.convertY(curve.end.z)
            );
            mapctx.strokeStyle = curve.color;
            mapctx.stroke();
        }
    }
    let curSprite;
    let spriteSize;
    let textMeasure;
    let tempMeasure = {};
    for(const marker of MapData.markers){
        curSprite = null;
        marker.visible = false;
        if((marker.minZoom && MapData.view.scale < marker.minZoom) || (marker.maxZoom && MapData.view.scale > marker.maxZoom)) continue;
        let markerX = MapData.view.convertX(marker.position.x);
        let markerY = MapData.view.convertY(marker.position.z);
        if(markerX > mapCanvas.width + Config.viewCullMargin || markerX < -Config.viewCullMargin || markerY > mapCanvas.height + Config.viewCullMargin || markerY < -Config.viewCullMargin) continue; // View Culling
        switch(marker.type){
            case 'junction':
                if(!(MapData.layers.junctions && MapData.layers.signage)) break;
                marker.visible = true;
                curSprite = Config.spriteBounds.junction;
                spriteSize = 30;
                break;
            case 'grade':
                if(!(MapData.layers.gradeArrows && MapData.layers.signage)) break;
                marker.visible = true;
                curSprite = Config.spriteBounds[`gradeArrow${MapData.layers.gradeDirection}_${marker.gradeClass}`];
                spriteSize = 30;
                mapctx.translate(markerX, markerY);
                mapctx.rotate(marker.rotation);
                mapctx.translate(-0.5*spriteSize * MapData.view.pixelRatio, -0.5*spriteSize * MapData.view.pixelRatio);
                mapctx.drawImage(
                    Utils.gradeArrows,
                    curSprite.x,
                    curSprite.y,
                    curSprite.width,
                    curSprite.height,
                    0,
                    0,
                    spriteSize * MapData.view.pixelRatio,
                    spriteSize * MapData.view.pixelRatio
                );
                mapctx.resetTransform();
                curSprite = null;
                break;
            case 'speed':
                if(!(MapData.layers.speedSigns && MapData.layers.signage)) break;
                marker.visible = true;
                curSprite = Config.spriteBounds['speed_'+Math.floor(marker.value/10)];
                spriteSize = 24;
                break;
            case 'service':
                if(!(MapData.layers.services && MapData.layers.poi)) break;
                marker.visible = true;
                spriteSize = 30 * MapData.view.pixelRatio;
                if(marker.serviceTypes.length == 0) marker.serviceTypes.push('');
                if(marker.serviceTypes.length > 1){
                    mapctx.fillStyle = '#239a96';
                    tempMeasure.width = spriteSize * (marker.serviceTypes.length-1);
                    mapctx.fillRect(markerX - tempMeasure.width*0.5, markerY - spriteSize*0.5, tempMeasure.width, spriteSize);
                }
                for(let i=0; i<marker.serviceTypes.length; i++){
                    curSprite = Config.spriteBounds[marker.serviceTypes[i] ? 'service_'+marker.serviceTypes[i].toLowerCase() : 'service'];
                    mapctx.drawImage(
                        mapSprites,
                        curSprite.x,
                        curSprite.y,
                        curSprite.width,
                        curSprite.height,
                        markerX-(0.5*spriteSize) + ((i-(marker.serviceTypes.length-1)*0.5)*spriteSize),
                        markerY-(0.5*spriteSize),
                        spriteSize,
                        spriteSize
                    );
                }
                if(!marker.tooltipHitzone){
                    marker.tooltipHitzone = {
                        width: spriteSize/MapData.view.pixelRatio * marker.serviceTypes.length,
                        height: spriteSize/MapData.view.pixelRatio
                    };
                }
                curSprite = null;
                break;
            case 'office':
            case 'coal':
            case 'water':
            case 'shop':
            case 'garage':
                if(!(MapData.layers.services && MapData.layers.poi)) break;
                marker.visible = true;
                curSprite = Config.spriteBounds[marker.type];
                spriteSize = 30;
                break;
            case 'landmark':
                if(!(MapData.layers.landmarks && MapData.layers.poi)) break;
                marker.visible = true;
                curSprite = Config.spriteBounds[marker.type];
                spriteSize = 25;
                break;
            case 'station':
                if(!(MapData.layers.stations && MapData.layers.poi)) break;
                marker.visible = true;
                mapctx.fillStyle = marker.color;
                mapctx.strokeStyle = '#000';
                mapctx.lineJoin = 'round';
                mapctx.lineWidth = 20*MapData.view.scale*MapData.view.pixelRatio;
                mapctx.font = `bold ${400*MapData.view.scale*MapData.view.pixelRatio}px "Noto Sans"`;
                textMeasure = mapctx.measureText(marker.shorthand);
                mapctx.strokeText(marker.shorthand, markerX - textMeasure.width * 0.5, markerY);
                mapctx.fillText(marker.shorthand, markerX - textMeasure.width * 0.5, markerY);
                if(!marker.tooltipHitzone) marker.tooltipHitzone = {};
                marker.tooltipHitzone.width = textMeasure.width/MapData.view.pixelRatio;
                marker.tooltipHitzone.height = textMeasure.actualBoundingBoxAscent/MapData.view.pixelRatio;
                marker.tooltipHitzone.offsetY = marker.tooltipHitzone.height * 0.5;
                if(MapData.view.scale < 0.14) break;
                mapctx.font = `bold ${70*MapData.view.scale*MapData.view.pixelRatio}px "Noto Sans"`;
                textMeasure = mapctx.measureText(marker.nickname ?? marker.name);
                mapctx.strokeText(marker.nickname ?? marker.name, markerX - textMeasure.width * 0.5, markerY+80*MapData.view.scale*MapData.view.pixelRatio);
                mapctx.fillText(marker.nickname ?? marker.name, markerX - textMeasure.width * 0.5, markerY+80*MapData.view.scale*MapData.view.pixelRatio);
                break;
            case 'yardSiding':
            case 'yard':
                if(!(MapData.layers.yardSigns && MapData.layers.signage)) break;
                marker.visible = true;
                mapctx.fillStyle = '#fff';
                mapctx.strokeStyle = '#000';
                mapctx.lineJoin = 'round';
                mapctx.lineWidth = 2*MapData.view.pixelRatio;
                mapctx.font = `${14*MapData.view.pixelRatio}px "Noto Sans Mono"`;
                textMeasure = mapctx.measureText(marker.name);
                tempMeasure.width = textMeasure.actualBoundingBoxLeft + textMeasure.actualBoundingBoxRight;
                tempMeasure.height = textMeasure.fontBoundingBoxAscent + textMeasure.fontBoundingBoxDescent;
                if(!marker.tooltipHitzone){
                    marker.tooltipHitzone = {
                        width: (tempMeasure.width + 20)/MapData.view.pixelRatio,
                        height: (tempMeasure.height + 8)/MapData.view.pixelRatio,
                        offsetY: (-tempMeasure.height * 0.5 + 3)/MapData.view.pixelRatio,
                    };
                }
                mapctx.beginPath();
                mapctx.moveTo(markerX, markerY);
                mapctx.roundRect(markerX - 0.5*tempMeasure.width - 4*MapData.view.pixelRatio, markerY - textMeasure.fontBoundingBoxDescent + 1*MapData.view.pixelRatio, tempMeasure.width + 12*MapData.view.pixelRatio, tempMeasure.height - 4*MapData.view.pixelRatio, 3*MapData.view.pixelRatio);
                mapctx.fill();
                mapctx.stroke();
                mapctx.fillStyle = '#000';
                mapctx.fillText(marker.name, markerX - 0.5*tempMeasure.width, markerY + 0.5*tempMeasure.height);
                break;
            case 'demonstratorSpawn':
                if(!(MapData.layers.demonstratorExact && MapData.layers.poi)) break;
                marker.visible = true;
                curSprite = Config.spriteBounds.demonstrator;
                spriteSize = 25;
                break;
            case 'demonstratorSpawnHint':
                if(!(MapData.layers.demonstratorHint && MapData.layers.poi)) break;
                marker.visible = true;
                if(!marker.tooltipHitzone) marker.tooltipHitzone = {};
                marker.tooltipHitzone.radius = marker.radius * MapData.view.scale;
                mapctx.beginPath();
                mapctx.moveTo(markerX, markerY);
                mapctx.arc(markerX, markerY, marker.radius*MapData.view.scale*MapData.view.pixelRatio, 0, Math.PI*2);
                mapctx.fillStyle = '#894b35';
                mapctx.globalAlpha = 0.65;
                mapctx.fill();
                mapctx.globalAlpha = 1.0;
                break;
            default:
                if(!MapData.layers.poi) break;
                marker.visible = true;
                curSprite = Config.spriteBounds.unknown;
                spriteSize = 30;
                break;
        }
        if(curSprite != null){
            mapctx.drawImage(
                mapSprites,
                curSprite.x,
                curSprite.y,
                curSprite.width,
                curSprite.height,
                markerX-(0.5*spriteSize)*MapData.view.pixelRatio,
                markerY-(0.5*spriteSize)*MapData.view.pixelRatio,
                spriteSize*MapData.view.pixelRatio,
                spriteSize*MapData.view.pixelRatio
            );
        }
    }
    MapData.view.dirty = false;
}