const svgContainer = document.getElementById('svgContainer');
const draggableImages = document.querySelectorAll(".draggable-images");
const contextMenu = document.getElementById("contextMenu");
const svg = Snap("#svgContainer");
let currentDragItem;
let groupSvg = svg.group().attr({
    name: 'Diagram'
});
let id = 1;
let selectedItem, selectedLine;
let contextItem;
let dashedLine;
let details;
let diagrams = [];
let relationShips = [];
let selectedElements = [];
let resizeHandle, rotateHandle;
let parsedXml;
let connectedElement;
let selectedArrow = imageType.ASSOCIATION;

let isDragging = false;
let startAngle = 0;
let startRotation = 0;

let scaleFactor = 1;

var startX, startY;
let centerX, centerY;
const textPosition = {
    x: 0,
    y: 0
}

svg.attr({
    width: '100%',
    height: '100%'
});

const menuItems = document.querySelectorAll('.menu li');

menuItems.forEach((item) => {
    item.addEventListener('click', () => {
        // Toggle the 'active' class to show/hide the dropdown
        item.classList.toggle('active');
    });
});

function calculateRotation(x1, y1, x2, y2) {
    const deltaX = x2 - x1;
    const deltaY = y2 - y1;

    // Calculate the rotation angle in radians
    const angleRadians = Math.atan2(deltaY, deltaX);

    // Convert radians to degrees
    return Snap.deg(angleRadians);
}

function reDrawLines(){
    relationShips = relationShips.filter((v) => v.line.removed !== true);
    relationShips.forEach((v) => {
        v.line.remove();
        if(v.text){
            v.text.remove();
        }
        // text.remove();
        if(v.arrowhead) {
            v.arrowhead.remove()
        }
        const bbox1 = v.from.getBBox();
        const bbox2 = v.to.getBBox();

        let center1;
        let center2;

        const image1 = v.from.children().find((v) => v.attr('type') !== imageType.TEXT);
        const image2 = v.to.children().find((v) => v.attr('type') !== imageType.TEXT);

        center1 = getElementPoint(image1.attr('type'), bbox1);
        center2 = getElementPoint(image2.attr('type'), bbox2);

        let lineType = v.line.attr('lineType') ? v.line.attr('lineType') : v.lineType;
        console.log('lineType', lineType);
        let text = null;
        const line = svg.line(center1.x, center1.y,
            parseFloat(center2.x),
            parseFloat(center2.y));

        const angle = getRotationAngle(center1.x, center1.y, center2.x, center2.y);
        if (v.text && [imageType.INCLUDE, imageType.EXTEND].includes(lineType)){
             text = svg.text(
                 ((center1.x + center2.x) / 2) - 30,
                angle < 12 || angle > -12 ?
                    ((center1.y + center2.y) / 2) - 15 : ((center1.y + center2.y) / 2),
                lineType === imageType.INCLUDE ? '<<include>>' : '<<extent>>'
            );
            text.attr({
                transform: `r${angle}`
            });
        }

        line.attr({
            lineType: lineType ?? selectedArrow,
            text: lineType === imageType.INCLUDE ? '<<include>>' : '<<extent>>'
        });
        // "M0,0 L10,5 L0,10"
        let arrowheadPath = "M0,0 L15,5 L0,13Z";
        let strokeDasharray = v.line.attr('strokeDasharray') ? v.line.attr('strokeDasharray') : null;
        let arrowhead = null;

        if(v.arrowhead){
            const arrowheadCenterX = parseFloat(center2.x) - 10;
            const arrowheadCenterY = parseFloat(center2.y) - 10;
            const isDashed = [imageType.INCLUDE, imageType.EXTEND].includes(lineType);
            arrowhead = svg.path(isDashed ? "M2,0 L15,7 L0,13" : arrowheadPath).attr({
                fill: "none",
                stroke: "black",
                strokeWidth: '2px',
                transform: `translate(${arrowheadCenterX},${arrowheadCenterY})
                 rotate(${Snap.deg(Math.atan2(line.attr("y2") - line.attr("y1"),
                    line.attr("x2") - line.attr("x1")))} 5 5)`
            });
        }
        line.attr({
            stroke: "black",
            strokeWidth: 2,
            strokeDasharray: [
                imageType.INCLUDE,
                imageType.EXTEND
            ].includes(v.line.attr('lineType')) ? '5.3' : null
        });

        line.click(() => {
            selectedLine = line;
            relationShips.forEach((v) => {
                v.line.attr({
                    stroke: 'black',
                    strokeDasharray
                });
            });
           line.attr({stroke: 'red' ,   strokeDasharray});
        });

        // arrowhead.remove();


        relationShips.push({
            from: v.from,
            to: v.to,
            arrowhead,
            line,
            text
        });
    });
}

function getElementPoint(type, bbox){
    if ([
        imageType.USE_CASE
    ].includes(type)){
        return { x: bbox.cx - (bbox.width / 2), y: bbox.cy };
    } else if ([imageType.ACTOR].includes(type)) {
        return { x: bbox.cx, y: bbox.cy };
    } else {
        return { x: bbox.cx, y: bbox.cy };
    }
}

function setDiagramsForModal(){
    templates.forEach((v) => {
        const span = document.createElement('span');
        span.innerText = v.category;
        span.classList.add('d-block');
        document.querySelector('.modal-body').append(span);
        v.items.forEach((i) => {
            const span = document.createElement('span');
            span.innerText = i.title;
            span.style.marginLeft = '15px';
            span.style.cursor = 'pointer';
            span.onclick = () => {
                connectDiagramToElement(i.content, i.title);
            }
            span.classList.add('d-block');
            document.querySelector('.modal-body').append(span);
        });
    })
}

function connectDiagramToElement(content, title){
    $('#diagramModal').modal('hide');
    const parsed = Snap.parse(content);
    const groupElements = parsed.selectAll("*:not(desc, defs)");
    createNewElements(content, title);
}

setDiagramsForModal();

function getRotationAngle(x1, y1, x2, y2) {
    const angleRadians = Math.atan2(y2 - y1, x2 - x1);
    return (angleRadians * 180) / Math.PI;
}

function drawLineBetweenElements(element1, element2) {
    if(!element1 || !element2){
        return;
    }

    if(element1.removed === true || element2.removed === true){
        return;
    }

    const isExist = relationShips
        .find((v) => v.from.attr('id') === element1.attr('id')
            && v.to.attr('id') === element2.attr('id') || v.from.attr('id') === element2.attr('id')
            && v.to.attr('id') === element1.attr('id'));

    if(isExist){
        return;
    }

    if(element1 === element1 && element2 === element1){
        return;
    }
    const image1 = element1.children().find((v) => v.attr('type') !== imageType.TEXT);
    const image2 = element2.children().find((v) => v.attr('type') !== imageType.TEXT);

    if (image1.attr('type') === imageType.SYSTEM || image2.attr('type') === imageType.SYSTEM){
        return;
    }


    // Get the bounding boxes of the elements
    const bbox1 = element1.getBBox();
    const bbox2 = element2.getBBox();

    // Calculate the center points of the elements
    const center1 = { x: bbox1.x, y: bbox1.y };
    const center2 = { x: bbox2.x, y: bbox2.y };

    if (selectedArrow instanceof HTMLElement) {
        selectedArrow = selectedArrow.getAttribute('type');
    }
    let text = null;
    if ([imageType.INCLUDE, imageType.EXTEND].includes(selectedArrow)){
        text = svg.text(
            (center1.x + center2.x) / 2,
            ((center1.y + center2.y) / 2) + 40,
            selectedArrow === imageType.INCLUDE ? '<<include>>' : '<<extend>>'
        );
        text.attr({
            transform: `r${getRotationAngle(center1.x, center1.y, center2.x, center2.y)}`
        })
    }
    const line = svg.line(center1.x, center1.y, center2.x, center2.y);
    let arrowhead = null;
    let strokeDasharray = null;

    // Draw a line connecting the centers of the elements
    line.attr({
        stroke: "black",
        strokeWidth: 2,
        strokeDasharray: selectedArrow === imageType.INCLUDE ?
            "5.3" : null,
        lineType: selectedArrow
    });

    switch (line.attr('lineType') ? line.attr('lineType') : imageType.ASSOCIATION){
        case imageType.GENERALIZATION: {
            arrowheadPath =  "M0,0 L15,5 L0,13Z";
            const arrowheadCenterX = line.attr("x2");
            const arrowheadCenterY = parseFloat(line.attr("y2")) - 5;

            // Create the arrowhead and position it at the end of the line
            arrowhead = svg.path(arrowheadPath).attr({
                fill: "none",
                stroke: "black",
                transform: `translate(${arrowheadCenterX},${arrowheadCenterY}) rotate(${Snap.deg(Math.atan2(line.attr("y2") - line.attr("y1"), line.attr("x2") - line.attr("x1")))} 5 5)`
            });
            break;
        }
        case imageType.INCLUDE:
        case imageType.EXTEND: {
            const arrowheadCenterX = parseFloat(line.attr("x2"));
            const arrowheadCenterY = parseFloat(line.attr("y2"));

            // Create the arrowhead and position it at the end of the line
            arrowhead = svg.path("M0,0 L15,7 L0,13").attr({
                fill: "none",
                stroke: "black",
                strokeWidth: '2px',
                transform: `translate(${arrowheadCenterX},${arrowheadCenterY}) rotate(${Snap.deg(Math.atan2(line.attr("y2") - line.attr("y1"), line.attr("x2") - line.attr("x1")))} 5 5)`
            });
            strokeDasharray = "5.3";
            break;
        }
        default: {

        }
    }

    relationShips.push({
        from: element1,
        to: element2,
        arrowhead: arrowhead,
        line,
        text
    });
    // selectedItem = null;
    deleteLine();
    // reDrawLines();
    return line;
}

async function fetchDrawioTemplate(svgElements){
    const res = await fetch('/templates/drawio_template.xml', {
        method: 'GET',
        headers: {
            'Content-Type': 'text/xml'
        }
    });
    const body = await res.text();
    const parser = new DOMParser();
    parsedXml = parser.parseFromString(body, "text/xml");
    convertToDrawioXml(svgElements);
}

function createXmlItem(group){

}

function convertToDrawioXml(svgElements){
    const root = parsedXml.querySelector("diagram root");
    let modifiedXmlString;
    svgElements.forEach((e) => {
        if(e.type === 'g'){
            const image = e.children().find((v) => v.attr('type') !== imageType.TEXT);
            const text = e.children().find((v) => v.attr('type') === imageType.TEXT);
            if(!image.attr('type')){
                return;
            }
            const mxCell = parsedXml.createElement('mxCell');
            const trans = image.transform().localMatrix;
            mxCell.setAttribute('id', e.id);
            mxCell.setAttribute('vertex', 1);
            mxCell.setAttribute('parent', 1);
            const mxGeometry = parsedXml.createElement('mxGeometry');
            mxGeometry.setAttribute('x', parseFloat(e.getBBox().x + trans.e));
            mxGeometry.setAttribute('y', parseFloat(e.getBBox().y + trans.f));
            mxGeometry.setAttribute('width', e.getBBox().width);
            mxGeometry.setAttribute('height', e.getBBox().height);
            mxGeometry.setAttribute('as', 'geometry');
            switch (image.attr('type')){
                case imageType.ACTOR: {
                    mxCell.setAttribute('style',
                        "shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;");
                    mxCell.setAttribute('value', e.attr('name'));
                    mxCell.setAttribute('outlineConnect', 0);
                    break;
                }
                case imageType.USE_CASE: {
                    mxCell.setAttribute('style',
                        "ellipse;whiteSpace=wrap;html=1;");
                    mxCell.setAttribute('value', e.attr('name'));
                    break;
                }
                case imageType.SYSTEM: {
                    mxCell.setAttribute('style',
                        "rounded=0;whiteSpace=wrap;html=1;");
                    mxCell.setAttribute('value', e.attr('name'));
                    break;
                }
                case imageType.TEXT: {
                    mxCell.setAttribute('style',
                        'text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;');
                    mxCell.setAttribute('value', e.attr('name'));
                    break;
                }
                default: {
                    const bbox = e.getBBox();
                    mxCell.setAttribute('style', 'endArrow=classic;html=1;rounded=0;');
                    mxCell.setAttribute('edge', '1');
                    const firstPoint = parsedXml.createElement('mxPoint');
                    firstPoint.setAttribute('x', bbox.x);
                    firstPoint.setAttribute('y', bbox.y + (bbox.height / 2));
                    firstPoint.setAttribute('as', 'sourcePoint');

                    const secondPoint = parsedXml.createElement('mxPoint');
                    secondPoint.setAttribute('x', bbox.x + bbox.width);
                    secondPoint.setAttribute('y', bbox.y + (bbox.height / 2));
                    secondPoint.setAttribute('as', 'targetPoint');

                    mxGeometry.appendChild(firstPoint);
                    mxGeometry.appendChild(secondPoint);
                    break;
                }
            }
            root.appendChild(mxCell);
            mxCell.appendChild(mxGeometry);
            const serializer = new XMLSerializer();
            modifiedXmlString = serializer.serializeToString(parsedXml);
        }
    });
    relationShips.filter((v) => v.line.removed !== true).forEach((v) => {
        const root = parsedXml.querySelector("diagram root");
        const mxCell = parsedXml.createElement('mxCell');
        mxCell.setAttribute('id', Math.random());
        mxCell.setAttribute('vertex', 1);
        mxCell.setAttribute('edge', 1);
        mxCell.setAttribute('parent', 1);
        switch (v.line.attr('lineType')){
            case imageType.ASSOCIATION: {
                mxCell.setAttribute('style', 'endArrow=classic;html=1;rounded=0;');
                break;
            }
            case imageType.INCLUDE: {
                mxCell.setAttribute('value', '&lt;&lt;include&gt;&gt;');
                mxCell.setAttribute('style', 'html=1;verticalAlign=bottom;labelBackgroundColor=none;endArrow=open;endFill=0;dashed=1;rounded=0;exitX=0.5;exitY=0.5;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.5;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;');
                break;
            }
            case imageType.EXTEND: {
                mxCell.setAttribute('value', '&lt;&lt;extent&gt;&gt;');
                mxCell.setAttribute('style', 'html=1;verticalAlign=bottom;labelBackgroundColor=none;endArrow=open;endFill=0;dashed=1;rounded=0;exitX=0.5;exitY=0.5;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.5;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;');
                break;
            }
            case imageType.GENERALIZATION: {
                mxCell.setAttribute('style', 'style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;entryX=0.5;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;"');
                break;
            }
        }
        mxCell.setAttribute('source', v.from.id);
        mxCell.setAttribute('target', v.to.id);
        const mxGeometry = parsedXml.createElement('mxGeometry');
        const mxPoint1 = parsedXml.createElement('mxPoint');
        mxPoint1.setAttribute('x', v.from.attr('x'));
        mxPoint1.setAttribute('y', v.from.attr('y'));
        mxPoint1.setAttribute('as', v.from.attr('sourcePoint'));
        const mxPoint2 = parsedXml.createElement('mxPoint');
        mxPoint2.setAttribute('x', v.from.attr('x'));
        mxPoint2.setAttribute('y', v.from.attr('y'));
        mxPoint2.setAttribute('as', v.from.attr('targetPoint'));
        mxGeometry.setAttribute('as', 'geometry');
        mxGeometry.appendChild(mxPoint1);
        mxGeometry.appendChild(mxPoint2);
        mxCell.appendChild(mxGeometry);
        root.appendChild(mxCell);
        const serializer = new XMLSerializer();
        modifiedXmlString = serializer.serializeToString(parsedXml);
    });
    downloadFile('drawio.xml', modifiedXmlString, 'text/xml');


}

function generateTemplates(){
    templates.forEach((v) => {
       const mainLi = document.createElement('li');
        mainLi.innerText = v.category;
        mainLi.onclick = () => {
            mainLi.classList.contains('open') ? mainLi.classList.remove('open') :  mainLi.classList.add('open');
        }
        if(v.items.length !== 0){
           const ul = document.createElement('ul');
           ul.classList.add('dropdown');
           v.items.forEach((i) => {
               const li = document.createElement('li');
               li.innerText = i.title;
               li.onclick = () => {
                   createNewElements(i.content, i.title);
               }
               ul.append(li);
           });
           mainLi.appendChild(ul);
        }

        document.querySelector('.menu').append(mainLi);
    });

}

generateTemplates();

// generate name for items
function generateName(type){
    const selectedType = names.find((v) => v.type === type);
    return selectedType.name;
}

// save category
function exportGroup(){
    groupSvg.children().forEach((v) => {
        if (v.attr('type') === imageType.TEXT){
            v.attr({
                text: v.attr('text').replaceAll('<', '&lt;')
                    .replaceAll('>', '&gt;')
            })
        }
    });
    const groupMarkup = svg.outerSVG();
    const parsed = Snap.parse(groupMarkup).selectAll("g");
    const diagramName = parsed[0].attr('name');
    diagrams.push({
        id: diagramName,
        svg: groupMarkup
    });

    console.log('groupMarkup', groupMarkup);

    groupSvg.children().forEach((v) => {
        if (v.attr('type') === imageType.TEXT){
            v.attr({
                text: v.attr('text').replaceAll('&lt;', '<')
                    .replaceAll('&gt;', '>')
            })
        }
    })
    renderCategories();
}
function renderCategories(){
    const leftSide = document.querySelector('.saved-diagrams');
    leftSide.innerHTML = "";
    for (let i = 0; i < diagrams.length; i++) {
        leftSide.appendChild(createText(diagrams[i]));
    }
}

function createText(diagram){
    const text = document.createElement('span');
    text.innerHTML = diagram.id;
    text.onclick = () => createNewElements(diagram.svg, diagram.id);
    return text;
}



function showItems(svg){
    document.getElementById('rightSide').innerHTML = "";
    const diagram = svg.children().map(e => e).filter(v => v.type === 'g');
    diagram.forEach((v, i) => {
            document.getElementById('rightSide').append(generateText(v));
            v.children().forEach((u) => {
                document.getElementById('rightSide').append(generateText(u));
            });
        });
}

function generateText(v){
    const p = document.createElement('p');
    p.innerText = `${v.attr('name') ?? ''}`;
    if (v.type !== 'g'){
        p.style.marginLeft = '15px';
    }
    p.ondblclick = () => {
        const input = document.createElement('input');
        input.value = p.innerText;
        input.onkeydown = (event) => onConfirmText(event, input, p, v);
        p.parentNode.replaceChild(input, p);
    }
    return p;
}

function onConfirmText(event, input, p, item){
    if (event.keyCode === 13){
        item.attr({
            name: input.value ?? ''
        });
        p.innerText = input.value;
        item.children().find((v) => v.attr('type') === imageType.TEXT).attr({
            text: input.value
        });
        // addAdditionalItems(
        //     null,
        //     currentDragItem.getAttribute('type'),
        //     item
        // );
        input.parentNode.replaceChild(p, input);
    }
}

// Function to toggle element selection
function toggleSelection(element) {
    let index = selectedElements.indexOf(element);
    if (index === -1) {
        selectedElements.push(element);
        element.attr({ stroke: "blue" });
    } else {
        selectedElements.splice(index, 1);
        element.attr({ stroke: "" });
    }
}

function createNewElements(svgString, name){
    const parsedElements = Snap.parse(svgString);
    const lineElements = parsedElements.selectAll("line");
    const groupElements = parsedElements.selectAll("g");
    const textElements = parsedElements.selectAll("text");
    let group = svg.group().attr({
        name,
        rendered: false
    });
    groupElements.forEach((v) => {
        addEventToSvg(v);
        group.add(v);
        const image = v.children().find((v) => v.attr('type') !== imageType.TEXT);
        contextMenuEvent(image);
    });
    lineElements.forEach((v) => {
        console.log('wqeqweqwewqeqweqwe', v);
        group.add((v));
    });

    groupSvg.add(group);
    console.log('lineElements', lineElements);
    console.log('groupElements', groupElements);
    const mainGroup = svg.selectAll('g[rendered="false"]')[0];
    reDrawExistLines(lineElements, groupElements);





    if (contextItem){
        const selectedX = +contextItem.attr("x") + +contextItem.attr("cx") || 0;
        const selectedY = +contextItem.attr("y") || +contextItem.attr("cy") || 0;
        const bbox = contextItem.getBBox();
        const images = mainGroup.selectAll("image");
        const diagram = svg.selectAll('g')[0].getBBox();
        images.forEach((v) => {
            if(v.attr('type') === imageType.ACTOR){
                v.parent().remove();
            }
        });
        mainGroup.children().forEach(function (element) {
            element.attr({
                side: mainGroup.getBBox().x - selectedX ? 'right' : 'left'
            });
            element.children().forEach(p => {
            const pBbox = p.getBBox();
            p.attr({
                    x: pBbox.x + bbox.x,
                    y: pBbox.y + bbox.y - diagram.cy
                });
            });
        });
        mainGroup.attr({
            rendered: true
        });
    }
    svg.append(groupSvg);
    showItems(svg);
    reDrawLines();
}

function updateViewBox() {
    const viewBoxWidth = svg.node.clientWidth / scaleFactor;
    const viewBoxHeight = svg.node.clientHeight / scaleFactor;
    const viewBoxX = (svg.node.clientWidth - viewBoxWidth) / 2;
    const viewBoxY = (svg.node.clientHeight - viewBoxHeight) / 2;
    const viewBox = [viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight];
    svg.attr({
        viewBox: viewBox.join(" "),
    });
}

svgContainer.addEventListener("wheel", handleMouseWheel);


function handleMouseWheel(evt) {
    evt.preventDefault();
    const delta = evt.wheelDelta ? evt.wheelDelta / 120 : -evt.detail / 3;
    const zoomFactor = Math.pow(1.1, delta); // Adjust the zoom speed
    scaleFactor *= zoomFactor;
    scaleFactor = Math.max(0.25, Math.min(2, scaleFactor)); // Limit the scale to a minimum and maximum value
    const groups = svg.selectAll("g");
    updateViewBox();
}

function reDrawExistLines(lines, groups){
    lines.forEach((l) => {
        let from;
        let to;
        let image;
        groups.forEach((g) => {
            const groupSize = g.getBBox();
            image = g.children().find((v) => v.attr('type') !== imageType.TEXT);
            if (!image){
                return;
            }
            console.log(l.attr('x1'), groupSize.cx);
            console.log(l.attr('y1'), groupSize.cy);
            if (l.attr('x1') == groupSize.cx
                && l.attr('y1') == groupSize.cy){
                alert('qwe');
                if (contextItem){
                    console.log('contextItem', contextItem);
                    from = image.attr('type') === imageType.ACTOR ? contextItem : g;
                } else {
                    from = g;
                }
            } else if (l.attr('x2') == getElementPoint(image.attr('type'), groupSize).x
                && l.attr('y2') == getElementPoint(image.attr('type'), groupSize).y){
                to = g;
            }
        });
        console.log('to             :', to);
        console.log('from             :', from);
        relationShips.push({
            from,
            to,
            line: l,
            lineType: l.attr('linetype'),
            text: l,
            arrowhead: l,
        });

    });
    console.log(relationShips);
    reDrawLines();
}

draggableImages.forEach((v) => {

    v.addEventListener('click', () => {
        if([
            imageType.ASSOCIATION,
            imageType.EXTEND,
            imageType.INCLUDE,
            imageType.GENERALIZATION
        ].includes(v.getAttribute('type'))){
            selectedArrow = v;
        }
    });

    v.addEventListener('dragstart', () => {
        currentDragItem = v;
    });

    v.addEventListener('dragend', (event) => {
        if (!currentDragItem){
            return;
        }
        addAdditionalItems(
            event,
            currentDragItem.getAttribute('type'),
        );
    });
});

function contextMenuEvent(element){
    element.node.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        contextItem = element.parent();
        contextMenu.style.left = e.clientX + "px";
        contextMenu.style.top = e.clientY + "px";
        contextMenu.classList.remove("hidden");
        textPosition.x = e.clientX;
        textPosition.y = e.clientY;
    });
}

function addAdditionalItems(event, type, item){
    const svgSize = svgContainer.getBoundingClientRect();
    let x = event.clientX - svgSize.left;
    let y = event.clientY - svgSize.top;
    let image;
    if (item){
        image = item;
    } else {
        image = svg.image(currentDragItem.src, x, y);
        image.attr({
            opacity: 0.8,
            rotate: 45,
            draggable: true,
            name: generateName(currentDragItem.getAttribute('type'))
        });
    }

    image.attr({
        type
    });

    contextMenuEvent(image);

    const group = svg.group();
    switch (image.attr('type')){
        case imageType.ACTOR: {
            const text = svg.text(x, y, 'Actor');
            text.attr({
                type: imageType.TEXT
            })
            group.add(image);
            group.add(text);
            group.attr({
                name: 'Actor'
            });
            const bbox = group.getBBox();
            text.attr({
                y: bbox.y2 + (bbox.height / 2) - 20
            })
            break;
        }
        case imageType.USE_CASE: {
            const text = svg.text(x, y, 'Use case');
            text.attr({
                type: imageType.TEXT
            });

            group.add(image);
            group.add(text);
            group.attr({
                name: 'Ellipse'
            });
            const textCoor = getCenterOfElement(group, text);
            text.attr({
                x: textCoor.x,
                y: textCoor.y
            });
            break;
        }
        case imageType.SYSTEM: {
            const text = svg.text(x, y, 'System');
            text.attr({
                type: imageType.TEXT
            });
            image.attr({
                'z-index': -1
            })
            group.add(image);
            group.add(text);
            group.attr({
                name: 'Box',
                'z-index': -1
            });
            const bbox = group.getBBox();
            text.attr({
                x: bbox.x2 - (bbox.width / 2) - 30,
                y: bbox.y2 - (bbox.height / 2) - 10
            });
            break;
        }
        default: {
            const text = svg.text(x, y, '<<include>>');
            text.attr({
                type: imageType.TEXT
            });

            group.add(image);
            group.add(text);
            group.attr({
                name: image.attr('name')
            });
            break;
        }
    }
    group.attr({
        id: id++
    });
    addEventToSvg(group);
    groupSvg.add(group);
    showItems(svg);
    currentDragItem = null;
}

function getCenterOfElement(group, text) {
    const bbox = group.getBBox();
    const centerX = bbox.x + bbox.width / 2;
    const centerY = bbox.y + bbox.height / 2;

    const textBBox = text.getBBox();
    const textWidth = textBBox.width;
    const textHeight = textBBox.height;

    const textX = centerX - textWidth / 2;
    const textY = centerY + textHeight / 4;

    return { x: textX, y: textY };
}

function addEventToSvg(item){
    const svgSize = svgContainer.getBoundingClientRect();
    item.drag((dx, dy, x, y) => onMove(dx, dy, x, y, item),
        onStart, onEnd);
    item.click(() => {
        selectedItem = item;
        deleteLine();
        generateDashedLines();
    });
    item.mouseup(function (){

    });
    item.mousedown(() => {
        drawLineBetweenElements(selectedItem, item);
    });

}

window.addEventListener('keydown', (event) => {
    if ((event.keyCode === 8 && selectedItem)){
        relationShips.forEach((v) => {
            const element = selectedItem.getBBox();
            if (v.line.attr('x1') == element.cx && v.line.attr('y1') == element.cy){
                v.line.remove();
                v.arrowhead ? v.arrowhead.remove() : null;
                v.text ? v.text.remove() : null;
                relationShips = relationShips.filter((l) => l.line.id !== v.line.id);
            } else if (v.line.attr('x2') == element.cx && v.line.attr('y2') == element.cy){
                v.line.remove();
                v.arrowhead ? v.arrowhead.remove() : null;
                v.text ? v.text.remove() : null;
                relationShips = relationShips.filter((l) => l.line.id !== v.line.id);
            }
            v.line.attr({
                stroke: 'black'
            });
        });
        selectedItem.remove();
        deleteLine();
        reDrawLines();
        showItems(svg);
    }

    if((event.keyCode === 8 && selectedLine)){
        selectedLine.remove();
        const selectedRelationShip = relationShips.find((v) => v.line.id === selectedLine.id);
        selectedRelationShip.arrowhead ? selectedRelationShip.arrowhead.remove() : null;
        selectedRelationShip.text ? selectedRelationShip.text.remove() : null;
        relationShips = relationShips.filter((v) => v.line.id !== selectedLine.id);
        relationShips.forEach((v) => {
            v.line.attr({
                stroke: 'black'
            });
        });
        selectedLine = null;
    }
});

function generateDashedLines(){
    const svgSize = svgContainer.getBoundingClientRect();
    if (!selectedItem){
        return;
    }
    selectedItem.attr({
        selected: true
    });
    let bbox = selectedItem.getBBox();

// Retrieve the dimensions and position of the group
    const x = selectedItem.attr("x");
    const y = selectedItem.attr("y");
    const width = selectedItem.attr("width");
    const height = selectedItem.attr("height");
    dashedLine = svg.rect(x, y, width, height); // Example rectangle element
    let transformMatrix = selectedItem.transform().globalMatrix;
    dashedLine.attr({
        stroke: "black",
        strokeWidth: 2,
        'fill-opacity': 0,
        'z-index': -10,
        transform: transformMatrix,
        name: 'Dashed line',
        strokeDasharray: "5 5" // Specifies a dash pattern of 5 units dash followed by 5 units gap
    });
    if(resizeHandle){
        resizeHandle.remove();
        rotateHandle.remove();
    }
    enableRotateAndResize(selectedItem);


    dashedLine.mousedown(function(event) {
        event.preventDefault(); // Prevent default drag behavior

        // Store initial properties
        let initialX = event.clientX - svgSize.left;
        let initialY = event.clientY - svgSize.top;
        let initialWidth = selectedItem.attr("width");
        let initialHeight = selectedItem.attr("height");
        let initialRotation = selectedItem.transform().rotate;

        details = {
            initialX,
            initialY,
            initialWidth,
            initialHeight,
            initialRotation
        }
    });
}

// Attach event listeners


function downloadXml(){
    const svgElements = [svg.selectAll("g")[0]];

    const allElements = svgElements[0].children()
        .filter((v) => v.children().length === 2);

    const diagramElements = svgElements[0].children()
        .filter((v) => v.children().length > 2)[0]
        .children().filter((v) => v.children().length > 0)
        .map((v) => v);

    allElements.push(...diagramElements);

    fetchDrawioTemplate(allElements);
}

function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type }); // Create a Blob object with the file content
    const url = URL.createObjectURL(blob); // Create a URL for the Blob object
    const link = document.createElement("a"); // Create a link element
    link.href = url; // Set the href attribute to the Blob URL
    link.download = filename; // Set the download attribute to specify the filename
    document.body.appendChild(link); // Append the link element to the document body
    link.click(); // Programmatically trigger a click event on the link element
    document.body.removeChild(link); // Remove the link element from the document body
    URL.revokeObjectURL(url); // Release the URL object
}

function resizeAndRotate(event) {
    let newX = event.clientX;
    let newY = event.clientY;

    // Calculate resize deltas
    let deltaX = newX - details.initialX;
    let deltaY = newY - details.initialY;

    // Calculate new width and height
    let newWidth = Math.max(parseFloat(details.initialWidth) + deltaX, 0);
    let newHeight = Math.max(parseFloat(details.initialHeight) + deltaY, 0);

    // Calculate rotation angle
    let angle = Math.atan2(newY - details.initialY, newX - details.initialX) * (180 / Math.PI);

    // Apply transformation attributes
    selectedItem.attr({
        x: details.initialX,
        y: details.initialY,
        width: newWidth,
        height: newHeight,
        transform: "rotate(" + (details.initialRotation + angle) + ")"
    });
}

function deleteLine(){
    if (resizeHandle){
        dashedLine = null;
        resizeHandle.remove();
        rotateHandle.remove();
        showItems(svg);
    }
}

svgContainer.addEventListener('dragover', (event) => {
    event.preventDefault();
});

svgContainer.addEventListener('click', function(event) {
    event.preventDefault();
    if(event.target.getAttribute('selected') !== 'true'){
        deleteLine();
        selectedItem = null;
        if(resizeHandle){
            resizeHandle.remove();
            rotateHandle.remove();
        }
    }
});

svgContainer.addEventListener('mouseup', (event) => {

});

let rotation = 0;
let cx, cy;

// Function to handle the mouse down event
function handleMouseDown(event) {
    if(selectedItem){
        isDragging = true;

        // Get the initial mouse position
        let startX = event.clientX;
        let startY = event.clientY;

        // Get the center of the SVG element
        let bbox = selectedItem.getBBox();
        cx = bbox.cx;
        cy = bbox.cy;

        // Calculate the start rotation based on the current transformation
        let matrix = selectedItem.transform().localMatrix;
        startRotation = Snap.deg(Math.atan2(matrix.f, matrix.e));
    }
}

// Function to handle the mouse move event
function handleMouseMove(event, item) {
    if (isDragging && selectedItem) {
        // Get the current mouse position
        let currentX = event.clientX;
        let currentY = event.clientY;

        // Calculate the angle between the initial mouse position and the current mouse position
        let angle = Math.atan2(currentY - cy, currentX - cx);

        // Calculate the new rotation based on the angle difference and the starting rotation
        let newRotation = Snap.deg(angle) - startRotation;

        deleteLine();
        generateDashedLines();

        // Apply the new rotation to the SVG element
        selectedItem.transform("r" + newRotation + "," + cx + "," + cy);
    }
}

function handleMouseUp() {
    isDragging = false;
    selectedItem = null;
}



// Function to handle drag start
function onStart() {
    if(resizeHandle){
        resizeHandle.remove();
        rotateHandle.remove();
    }
    this.data('ot', this.transform().local);
}

function onWheel(event) {
    event.preventDefault();
    let delta = event.deltaY || event.wheelDelta;
    if (delta > 0) {
        // Zoom out
        scaleFactor -= 0.1;
    } else {
        // Zoom in
        scaleFactor += 0.1;
    }

    // Set a minimum and maximum scale factor to limit zoom level
    scaleFactor = Math.min(Math.max(0.5, scaleFactor), 3);
}

// Function to handle drag move
function onMove(dx, dy, x, y, image) {
    let t = image.data('ot');
    const svgSize = svgContainer.getBoundingClientRect();
    const width = image.attr("width");
    const height = image.attr("height");
    image.attr({
        transform: t + (t ? "T" : "t") + [dx, dy],
    });
    generateDashedLines();

}

// Function to handle drag end
function onEnd() {
    // Code to run when dragging ends (if needed)
    isDragging = false;
    selectedItem = null;
    reDrawLines();
}

// Enable rotation and resizing

// Function to enable rotation and resizing
function enableRotateAndResize(element) {
    const selectItem = element.children()
        .find(v => v.attr('type') !== imageType.TEXT);
    resizeHandleAdd(selectItem, element);
}

function resizeHandleAdd(element, group){
    let bbox = element.getBBox();
    let bboxGroup = group.getBBox();
    element.attr({
        selected: true
    });
    const x = parseFloat(element.attr('x'));
    const y = parseFloat(element.attr('y'));
    resizeHandle = svg.rect(bboxGroup.x2 - 8, bboxGroup.y2 - 8, 8, 8);
    const text = group.children().find(v => v.attr('type') === imageType.TEXT);
    rotateHandle = svg.image('/images/rotate-right.png',
        bboxGroup.x - 8,
        bboxGroup.y - 8);
    rotateHandle.mousedown(function (event) {
        isDragging = true;
        const { clientX, clientY } = event;
        const boundingBox = element.getBBox();
        centerX = boundingBox.cx;
        centerY = boundingBox.cy;
        startAngle = Math.atan2(clientY - centerY, clientX - centerX);
        startRotation = element.transform().localMatrix.split().rotate;
    });

    svg.mousemove(function (event) {
        if (isDragging) {
            const { clientX, clientY } = event;
            const currentAngle = Math.atan2(clientY - centerY, clientX - centerX);
            const rotation = (currentAngle - startAngle) * (180 / Math.PI) + startRotation;
            text.attr({
                transform: `rotate(${rotation},${centerX},${centerY})`
            });
            element.attr({ transform: `rotate(${rotation},${centerX},${centerY})` });
        }
    });
    svg.mouseup(function () {
        isDragging = false;
        svg.unmousemove();
        // svg.mouseup();
    });
    resizeHandle.attr({
        fill: "white",
        stroke: "black",
        cursor: "pointer",
    });
    resizeHandle.drag(
        (dx, dy) => onResizeMove(dx, dy, element, text),
        () => onResizeStart(bbox, element),
        onResizeEnd
    );
}

// Function to handle resizing start
function onResizeStart(bbox, image) {
    // resizeHandle.remove();
    // rotateHandle.remove();
    image.data("ot", bbox);
}

// Function to handle resizing move
function onResizeMove(dx, dy, element, text) {
    let bbox = element.data("ot");
    let newWidth = bbox.width + dx;
    let newHeight = bbox.height + dy;
    if (newWidth > 0 && newHeight > 0) {
        deleteLine();
        generateDashedLines();
        switch (element.attr('type')){
            case imageType.ACTOR: {
                text.attr({
                    x: parseFloat(element.attr('x')) + (parseFloat(element.attr('width')) / 2) - 15,
                    y: parseFloat(element.attr('y')) + parseFloat(element.attr('height')) + 15,
                });
                break;
            }
            case imageType.USE_CASE: {
                const coor = getCenterOfElement(element, text);
                text.attr({
                    x: coor.x,
                    y: coor.y
                })
                break;
            }
            case imageType.SYSTEM: {
                const coor = getCenterOfElement(element, text);
                text.attr({
                    x: parseFloat(element.attr('x')) + (parseFloat(element.attr('width')) / 2) - 30,
                    y: parseFloat(element.attr('y')) + 40
                });
                break;
            }
            default: {
                const coor = getCenterOfElement(element, text);
                text.attr({
                    x: coor.x,
                    y: coor.y - 40
                })
                break;
            }
        }
        element.attr({
            width: newWidth,
            height: newHeight,
        });
    }
}

// Function to handle resizing end
function onResizeEnd() {
    resizeHandle.remove();
    // Code to run when resizing ends (if needed)
}
document.addEventListener("click", () => {
    contextMenu.classList.add("hidden");
});
