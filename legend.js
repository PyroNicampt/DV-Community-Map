'use strict';

let settingEntries = [
    {
        label: 'Signage',
        id: 'toggle_signage',
        state: true,
        func: state =>{
            document.getElementById('map_markers').style.display = state ? 'unset' : 'none';
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