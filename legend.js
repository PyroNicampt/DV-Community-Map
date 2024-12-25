'use strict';

import * as Utils from './js/utillib.js';

let settingEntries = [
    {
        label: 'Signage',
        id: 'toggle_signage',
        state: true,
        func: state =>{
            document.getElementById('mapMarkers').style.display = state ? 'unset' : 'none';
        },
        children: [
            {
                label: 'Speed Signs',
                id: 'toggle_speedSigns',
                state: true,
                func: state =>{
                    document.getElementById('speed_signs').style.display = state ? 'unset' : 'none';
                },
            },
            {
                label: 'Grade Arrows',
                id: 'toggle_gradeSigns',
                state: true,
                func: state =>{
                    document.getElementById('grade_signs').style.display = state ? 'unset' : 'none';
                },
            }
        ],
    },
    {
        label: 'Track Color',
        id: 'radio_trackColor',
        options: [
            'None',
            'Grade',
        ],
        default: 1,
    },
];

const legendKey = document.getElementById('legendKey');

document.addEventListener('DOMContentLoaded', async () => {
    const settingsPanel = document.getElementById('settingsPanel');
    for(let thisSetting of settingEntries){
        addSettingEntry(thisSetting, settingsPanel);
    }
    const legend = document.getElementById('legend');
    const legendButton = document.getElementById('legendButton');
    const legendArrow = legendButton.children[0];
    let legendState = true;
    let legendButtonEvent = e => {
        legendArrow.style.transform = `rotate(${legendState ? 180 : 0}deg) translateY(${legendState ? -3 : 3}px)`;
        legend.style.transform = `translateX(${legendState ? 0 : legendButton.clientWidth-legend.clientWidth}px)`;
        legendState = !legendState;
    };
    legendButton.addEventListener('click', legendButtonEvent);
    legendButtonEvent();
    populateKey();
});

function addSettingEntry(thisSetting, parent, indent=0){
    thisSetting.divContainer = document.createElement('div');
    thisSetting.divContainer.innerHTML = '&nbsp;'.repeat(indent);
    thisSetting.inputElement = document.createElement('input');
    thisSetting.labelElement = document.createElement('label');
    parent.appendChild(thisSetting.divContainer);
    thisSetting.divContainer.appendChild(thisSetting.inputElement);
    thisSetting.divContainer.appendChild(thisSetting.labelElement);
    
    let settingType = thisSetting.id.split('_')[0];
    switch(settingType){
        case 'toggle':
            thisSetting.inputElement.type = 'checkbox';
            thisSetting.inputElement.id = thisSetting.id;
            thisSetting.inputElement.checked = thisSetting.state;
            thisSetting.labelElement.innerHTML = thisSetting.label;
            thisSetting.labelElement.htmlFor = thisSetting.id;

            if(thisSetting.func){
                thisSetting.inputElement.addEventListener('input', e =>{
                    thisSetting.func(e.target.checked);
                    if(thisSetting.children){
                        for(const child of thisSetting.children){
                            document.getElementById(child.id).parentElement.style.display = e.target.checked ? '' : 'none';
                        }
                    }
                });
            }
            break;
        default:
            thisSetting.divContainer.remove();
            return;
    }
    if(thisSetting.children){
        for(let child of thisSetting.children){
            addSettingEntry(child, parent, indent+1);
        }
    }
}

function populateKey(){
    addKeyEntry(null, '<span style="font-size:smaller">(Grade arrows point uphill)</span>');
    const getGradeValue = gradeIndex => {return Math.round(Utils.gradeIncrements[Utils.gradeIncrements.length-gradeIndex-1]*10000)/100};
    for(let i=-1; i<Utils.gradeIncrements.length; i++){
        let gradeValue = `< ${getGradeValue(0)}`;
        let gradeIndex = 'flat';
        if(i>=0){
            gradeValue = `${getGradeValue(i)}`;
            gradeIndex = i;
        }
        if(i == Utils.gradeIncrements.length-1){
            gradeValue = '> '+gradeValue+'%';
        }else if(i >= 0){
            gradeValue += ` - ${getGradeValue(i+1)}%`;
        }
        let gradeIcon = document.createElement('svg');
        gradeIcon.classList.add('inlineSvg');
        gradeIcon.setAttribute('viewBox', '-50 -50 100 100');
        gradeIcon.innerHTML = `<use class="gradeSign grade_${gradeIndex}" href="#gradeArrow" transform="rotate(90)"/>`;
        addKeyEntry(gradeIcon, ` ${gradeValue} Grade`);
    }
    let speedSignIcon = document.createElement('svg');
    speedSignIcon.classList.add('inlineSvg');
    speedSignIcon.setAttribute('viewBox', '-50 -50 100 100');
    speedSignIcon.innerHTML = `<use class="speedSign" href="#speedSign_5"/>`;
    addKeyEntry(speedSignIcon, ' Speed Limit');
}

/**
 * Add an entry to the map key.
 * @param {Element} keyImage 
 * @param {string} keyLabel 
 */
function addKeyEntry(keyImage, keyLabel){
    let keyDiv = document.createElement('div');
    if(keyImage) keyDiv.appendChild(keyImage);
    keyDiv.innerHTML += keyLabel;
    legendKey.appendChild(keyDiv);
}