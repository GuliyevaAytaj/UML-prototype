const svgContainer = document.getElementById('svgContainer');
const draggableImages = document.querySelectorAll(".draggable-images");
const contextMenu = document.getElementById("contextMenu");
const svg = Snap("#svgContainer");
let currentDragItem;
let groupSvg = svg.group().attr({
    name: 'Diagram',
    type: 'main'
});
let id = 1;
let selectedItem, selectedLine;
let contextItem;
let dashedLine;
let diagrams = [];
let relationShips = [];
let resizeHandle, rotateHandle;
let parsedXml;
let selectedArrow = imageType.ASSOCIATION;
let isDragging = false;
let startAngle = 0;
let startRotation = 0;
let scaleFactor = 1;
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
        item.classList.toggle('active');
    });
});

function reDrawLines(){
    relationShips = relationShips.filter((v) => v.line.removed !== true);
    relationShips.forEach((v) => {
        v.line.remove();
        if(v.text){
            v.text.remove();
        }
        if(v.arrowhead) {
            v.arrowhead.remove()
        }

        let bbox1 = v.from.getBBox();
        let bbox2 = v.to.getBBox();
        let center1;
        let center2;

        const image1 = v.from.children().find((v) => v.attr('type') !== imageType.TEXT);
        const image2 = v.to.children().find((v) => v.attr('type') !== imageType.TEXT);

        center1 = getElementPoint(image1.attr('type'), bbox1);
        center2 = getElementPoint(image2.attr('type'), bbox2);

        let lineType = v.lineType ? v.lineType : v.line.attr('lineType');
        let text = null;
        const line = svg.line(center1.x, center1.y,
            parseFloat(center2.x),
            parseFloat(center2.y));

        if (v.text && [imageType.INCLUDE, imageType.EXTEND].includes(lineType)){
             text = svg.text(
                 ((center1.x + center2.x) / 2) - 30, ((center1.y + center2.y) / 2) -10,
                lineType === imageType.INCLUDE ? '<<include>>' : '<<extent>>'
            );
        }

        line.attr({
            lineType: lineType ?? selectedArrow,
            text: lineType === imageType.INCLUDE ? '<<include>>' : '<<extent>>'
        });

        let arrowheadPath = "M0,0 L15,5 L0,13Z";
        let strokeDasharray = v.line.attr('strokeDasharray') ? v.line.attr('strokeDasharray') : null;
        let arrowhead = null;

        if(v.arrowhead){
            const arrowheadCenterX = parseFloat(center2.x) - 10;
            const arrowheadCenterY = parseFloat(center2.y) - 8;
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
            ].includes(lineType) ? '5.3' : null
        });

        if (image1.attr('type') === imageType.USE_CASE || image2.attr('type') === imageType.USE_CASE){
            const elements = [image1, image2];
            const useCases = elements.filter((v) => v.attr('type') === imageType.USE_CASE);
            let a;
            useCases.forEach((useCase) => {
                const bbox = useCase.parent().getBBox();
                const angleInDegrees = Snap.deg(Math.atan2(line.attr("y2") - line.attr("y1"),
                    line.attr("x2") - line.attr("x1")));
                if (
                    (parseFloat(line.attr('x1')) + (bbox.width / 2)) < parseFloat(line.attr('x2'))
                ){
                    if(useCase.parent().id === v.from.id){
                        let x1 = parseFloat(line.attr('x1')) + bbox.width;
                        let y1 = bbox.cy;
                        line.attr({
                            x1,
                            y1
                        });
                    }
                }
                if((parseFloat(line.attr('x2')) + (bbox.width / 2)) < parseFloat(line.attr('x1'))){

                    if(useCase.parent().id === v.from.id){
                        return;
                    }
                    a = parseFloat(line.attr('x2')) + bbox.width;
                    if (arrowhead){
                        arrowhead.transform(`translate(${a},${bbox.cy - 3}) rotate(${angleInDegrees} 5 5)`);
                    }
                    line.attr({
                        x2: a,
                        y2: bbox.cy
                    });
                }
            });
        }

        line.click(() => {
            selectedLine = line;
            relationShips.forEach((v) => {
                v.line.attr({
                    stroke: 'black',
                    strokeDasharray: v.line.attr('strokeDasharray')
                });
            });
           line.attr({stroke: 'red' ,   strokeDasharray});
        });

        relationShips.push({
            from: v.from,
            to: v.to,
            arrowhead,
            line,
            lineType,
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

function validationForDiagrams(content, callback){
    if (content.length === 0){
        alert('No content');
    }
    callback()
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
                validationForDiagrams(i.content, () => {
                    connectDiagramToElement(i.content, i.title);
                });
            }
            span.classList.add('d-block');
            document.querySelector('.modal-body').append(span);
        });
    })
}

function connectDiagramToElement(content, title){
    $('#diagramModal').modal('hide');
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
    const bbox1 = element1.getBBox();
    const bbox2 = element2.getBBox();
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
    let lineType = selectedArrow ? selectedArrow : imageType.ASSOCIATION;

    line.attr({
        stroke: "black",
        strokeWidth: 2,

        strokeDasharray: selectedArrow === imageType.INCLUDE ?
            "5.3" : null,
        lineType: lineType ?? selectedArrow
    });


    switch (lineType){
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
                transform: `translate(${arrowheadCenterX},${(arrowheadCenterY)}) rotate(${Snap.deg(Math.atan2(line.attr("y2") - line.attr("y1"), line.attr("x2") - line.attr("x1")))} 5 5)`
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
        lineType: selectedArrow,
        line,
        text
    });
    deleteLine();
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

function toBack(){
    const group = svg.selectAll("g")[0];
    group.prepend(contextItem);
    renderCategories();
}

function toFront(){
    const group = svg.selectAll("g")[0];
    group.append(contextItem);
    renderCategories();
}

function convertToDrawioXml(svgElements){
    const root = parsedXml.querySelector("diagram root");
    let modifiedXmlString;
    svgElements.forEach((e) => {
        if(e.type === 'g'){
            const image = e.children().find((v) => v.attr('type') !== imageType.TEXT);
            if(!image){
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
                    mxCell.setAttribute('value', e.attr('name') ? e.attr('name') : '');
                    mxCell.setAttribute('outlineConnect', 0);
                    break;
                }
                case imageType.USE_CASE: {
                    mxCell.setAttribute('style',
                        "ellipse;whiteSpace=wrap;html=1;");
                    mxCell.setAttribute('value', e.attr('name') ? e.attr('name') : '');
                    break;
                }
                case imageType.SYSTEM: {
                    mxCell.setAttribute('style',
                        "rounded=0;whiteSpace=wrap;html=1;");
                    mxCell.setAttribute('value', e.attr('name') ? e.attr('name') : '');
                    break;
                }
                case imageType.TEXT: {
                    mxCell.setAttribute('style',
                        'text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;');
                    mxCell.setAttribute('value', e.attr('name') ? e.attr('name') : '');
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
                mxCell.setAttribute('style', 'endArrow=none;html=1;rounded=0;');
                break;
            }
            case imageType.INCLUDE: {
                mxCell.setAttribute('value', '&lt;&lt;include&gt;&gt;');
                mxCell.setAttribute('style', 'html=1;verticalAlign=bottom;labelBackgroundColor=none;endArrow=open;endFill=0;dashed=1;rounded=0;exitX=0.986;exitY=0.428;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;');
                break;
            }
            case imageType.EXTEND: {
                mxCell.setAttribute('value', '&lt;&lt;extent&gt;&gt;');
                mxCell.setAttribute('style', 'html=1;verticalAlign=bottom;labelBackgroundColor=none;endArrow=open;endFill=0;dashed=1;rounded=0;exitX=0.5;exitY=0.5;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;');
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
        const bbox = v.from.getBBox();
        mxPoint1.setAttribute('x', bbox.x);
        mxPoint1.setAttribute('y', bbox.y);
        mxPoint1.setAttribute('as', 'sourcePoint');
        const mxPoint2 = parsedXml.createElement('mxPoint');
        mxPoint2.setAttribute('x', bbox.x);
        mxPoint2.setAttribute('y', bbox.y);
        mxPoint2.setAttribute('as', 'targetPoint');
        mxGeometry.setAttribute('as', 'geometry');
        mxGeometry.setAttribute('width', '50');
        mxGeometry.setAttribute('height', '50');
        mxGeometry.setAttribute('relative', '1');
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
                   validationForDiagrams(i.content, () => {
                       createNewElements(i.content, i.title, 'new');
                   });
               }
               ul.append(li);
           });
           mainLi.appendChild(ul);
        }

        document.querySelector('.menu').append(mainLi);
    });

}

generateTemplates();

function generateName(type){
    const selectedType = names.find((v) => v.type === type);
    return selectedType.name;
}

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
            document.getElementById('rightSide').append(generateText(v, 1));
            v.children().forEach((u) => {
                document.getElementById('rightSide').append(generateText(u, 2));
                u.children().forEach((p) => {
                    if(u.children().length === 2){
                        return;
                    }
                    document.getElementById('rightSide').append(generateText(p, 3));
                })
            });
        });
}

function generateText(v, level){
    const p = document.createElement('p');
    p.innerText = `${v.attr('name') ?? ''}`;
    if (level){
        p.style.marginLeft = (level * 15) + 'px';
    }
    p.onclick = (e) => {
        e.preventDefault();
        selectedItem = null;
        if (resizeHandle){
            resizeHandle.remove();
            rotateHandle.remove();
        }
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
        input.parentNode.replaceChild(p, input);
    }
}

function createSystem(){
    let system = svg.select('image[type="SYSTEM"]');
    if (system){
        system.parent().remove();
    }
    system = svg.image('/images/box.svg', 0, 0, 0, 0);
    system.attr({
        opacity: 0.8,
        rotate: 45,
        draggable: true,
        type: imageType.SYSTEM,
        name: 'System'
    });
    const group = svg.group();
    const text = svg.text(0, 0, 'System');
    text.attr({
        type: imageType.TEXT
    });
    system.attr({
        'z-index': -1
    });
    group.add(system);
    group.add(text);
    contextMenuEvent(system);
    group.attr({
        name: 'System',
        'z-index': -1
    });
    addEventToSvg(group);
    svg.prepend(group);
}

function findSystemResizeAndRemoveOthers(){
    createSystem();
    let image = svg.select('image[type="SYSTEM"]');
    const actor = svg.select('image[type="ACTOR"]');
    const main = svg.select('g[type="main"]');
    const mainBbox = main.getBBox();
    const actorBbox = actor.node ?  actor.getBBox() : 0;
    if (image){
        image.attr({
            width: mainBbox.width + 100,
            height: mainBbox.height + 100,
            x: (mainBbox.x - 100 / 2),
            y: (mainBbox.y - 100 / 2)
        });
        if (actor){
            const parent = actor.parent();
            actor.attr({
                x: (mainBbox.x - 100 / 2) - actorBbox.width - 50
            });
            parent.children()[1].attr({
                x: (mainBbox.x - 100 / 2) - actorBbox.width - 50
            });
        }
        const systemBbox = image.getBBox();
        const systemText = image.parent().children().find((v) => v.attr('type') === imageType.TEXT);
        systemText.attr({
            x: systemBbox.x2 - (systemBbox.width / 2) - 30,
            y: systemBbox.y + 30
        });
    }

    const useCases = svg.selectAll('image[type="USE_CASE"]');
    useCases.forEach((u) => {
       const parent = u.parent();
        const coor = getCenterOfElement(parent.children()[0], parent.children()[1]);
        parent.children()[1].attr({
            x: coor.x,
            y: coor.y
        })
    });
    reDrawLines();
}

function createNewElements(svgString, name, newElement){
    const parsedElements = Snap.parse(svgString);
    const lineElements = parsedElements.selectAll("line");
    const groupElements = parsedElements.selectAll("g");
    const pathElements = parsedElements.selectAll("path");

    let group = svg.group().attr({
        name,
        rendered: false
    });
    groupElements.forEach((v) => {
        if (Boolean(v.attr('rendered') || Boolean(v.attr('type')))){
            return;
        }
        addEventToSvg(v);
        group.add(v);
        const image = v.children().find((v) => v.attr('type') !== imageType.TEXT);
        if (!image){
            return;
        }
        if (image.attr('type') === imageType.SYSTEM){
            image.parent().remove();
        }
        contextMenuEvent(image);
    });
    lineElements.forEach((v) => {
        group.add(v);
    });


    for (let j = 0; j < lineElements.length; j++) {
        for (let i = 0; i < pathElements.length; i++) {
            const lineType = lineElements[j].attr('lineType')
                ? lineElements[j].attr('lineType')
                : lineElements[j].attr('linetype');
            if(lineType){
                lineElements[j].arrowhead = lineType === imageType.ASSOCIATION ? null : pathElements[i];
                break;
            }
        }
    }

    groupSvg.add(group);
    reDrawExistLines(lineElements, groupElements);
    if (contextItem){
        const selectedX = +contextItem.attr("x") + +contextItem.attr("cx") || 0;
        const bbox = contextItem.getBBox();
        const images = group.selectAll("image[type='ACTOR']");
        const diagram = svg.selectAll('g')[0].getBBox();
        if (images.length >= 2){
            images.forEach((v) => {
                if(v.parent().attr('name') === contextItem.attr('name')){
                    v.parent().remove();
                }
            });
        } else {
            images[0].parent().remove();
        }
        group.children().forEach(function (element) {
            element.children().forEach(p => {
            const pBbox = p.getBBox();
            p.attr({
                    x: pBbox.x + bbox.x,
                    y: pBbox.y + bbox.y - diagram.cy
                });
            });
        });
    }


    const mainDiagram = svg.select("g[type='main']");
    const bbox = mainDiagram.getBBox();
    const lastDiagram = mainDiagram.children()[mainDiagram.children().length - 2];
    let lastDiagramBbox = lastDiagram ? lastDiagram.getBBox() : 0;
    const justAddedPattern = mainDiagram.children()[mainDiagram.children().length - 1];
    const justAddedPatternBbox = justAddedPattern.getBBox();
    group.children().forEach(function (element) {
        element.children().forEach(p => {
            const pBbox = p.getBBox();
            if (lastDiagram && mainDiagram.children().length === 2){
                p.attr({
                    x: pBbox.x,
                    y: pBbox.y
                });
                return;
            }
            if (!contextItem){
                p.attr({
                    x: pBbox.x + bbox.x + bbox.width,
                    y: pBbox.y + bbox.y
                });
                return;
            }

            const place = checkPlace({
                rightSideX: justAddedPatternBbox.x,
                rightSideWidth: justAddedPatternBbox.width,
                rightSideY: justAddedPatternBbox.y,
                rightSideHeight: justAddedPatternBbox.height
            });
            if (mainDiagram.children().length > 2 && place){
                p.attr({
                    y: pBbox.y + lastDiagramBbox.y + (lastDiagramBbox.height / 2) + justAddedPatternBbox.height
                });
            } else {
                p.attr({
                    x:  (justAddedPatternBbox.width / 2) + pBbox.x,
                });
            }
        });
    });

    svg.append(groupSvg);
    showItems(svg);
    reDrawLines();
    if (newElement && mainDiagram.children().length === 1){
        findSystemResizeAndRemoveOthers();
    } else if (!newElement){
        findSystemResizeAndRemoveOthers();
    }
    const useCases = svg.selectAll('image[type="USE_CASE"]');
    useCases.forEach((u) => {
        const parent = u.parent();
        const coor = getCenterOfElement(parent.children()[0], parent.children()[1]);
        parent.children()[1].attr({
            x: coor.x,
            y: coor.y
        })
    });
    group.attr({
        rendered: true
    });
}

function checkPlace(place){
    let result = false;
    svg.selectAll("svg > *").forEach(function (element) {
        const bbox = element.getBBox();
        const main = svg.select('g[type="main"]');
        const system = svg.select('image[type="SYSTEM"]');
        if ((bbox.x < place.rightSideX + place.rightSideWidth &&
            bbox.x + bbox.width > place.rightSideX &&
            bbox.y < place.rightSideY + place.rightSideHeight &&
            bbox.y + bbox.height > place.rightSideY) &&
            main.id !== element.id &&
            system.parent().id !== element.id){
            result = true;
        }
    });
    return result;
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
            if (l.attr('x1').split(".")[0] == Math.round(Number(String(groupSize.cx).split(".")[0]))
                && l.attr('y1').split(".")[0] == Math.round(Number(String(groupSize.cy).split(".")[0])) ||
                (parseFloat(l.attr('x1').split(".")[0]) + groupSize.width) &&
                l.attr('y1').split(".")[0] == Math.round(Number(String(groupSize.cy).split(".")[0]))){
                if (contextItem){
                    from = image.attr('type') === imageType.ACTOR ? contextItem : g;
                } else {
                    from = g;
                }
            } else if (l.attr('x2').split(".")[0] == Math.round(Number(String(getElementPoint(image.attr('type'), groupSize).x).split(".")[0]))
                && l.attr('y2').split(".")[0] == Math.round(Number(String(getElementPoint(image.attr('type'), groupSize).y).split(".")[0])) ||
                (parseFloat(l.attr('x2').split(".")[0]) + groupSize.width)
                && l.attr('y2').split(".")[0] == Math.round(Number(String(getElementPoint(image.attr('type'), groupSize).y).split(".")[0]))){
                if (contextItem){
                    to = image.attr('type') === imageType.ACTOR ? contextItem : g;
                } else {
                    to = g;
                }
            }

        });

        let lineType = l.attr('linetype') ? l.attr('linetype') : l.attr('lineType');
        relationShips.push({
            from,
            to,
            line: l,
            lineType,
            text: l,
            arrowhead: l.arrowhead ? l.arrowhead : null
        });

    });

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
    if (!element){
        return;
    }
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
    let x;
    let y;
    if (event instanceof MouseEvent) {
        x = event.clientX - svgSize.left;
        y = event.clientY - svgSize.top;
    } else {
        x = event.x;
        y = event.y;
    }
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
                name: 'Use case'
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
                name: 'System',
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
    item.drag((dx, dy, x, y) => onMove(dx, dy, x, y, item),
        onStart, onEnd);
    item.click(() => {
        selectedItem = item;
        deleteLine();
        generateDashedLines();
    });

    item.mousedown(() => {
        drawLineBetweenElements(selectedItem, item);
    });

}

window.addEventListener('keydown', (event) => {
    if ((event.keyCode === 8 && selectedItem)){
        relationShips.forEach((v) => {
            const element = selectedItem.getBBox();
            const elementWidth = Math.round(element.cx - (element.width / 2));
            const lineX1 = Math.round(v.line.attr('x1'));
            const lineX2 = Math.round(v.line.attr('x2'));
            const lineY1 = Math.round(v.line.attr('y1'));
            const lineY2 = Math.round(v.line.attr('y2'));
            if ((lineX1 == Math.round(element.cx) && lineY1 == Math.round(element.cy))
                || lineX1 == elementWidth && lineY1 == Math.round(element.cy)){
                v.line.remove();
                v.arrowhead ? v.arrowhead.remove() : null;
                v.text ? v.text.remove() : null;
                relationShips = relationShips.filter((l) => l.line.id !== v.line.id
                    && l.line.removed !== true);
            } else if ((lineX2 == Math.round(element.cx) && lineY2 == Math.round(element.cy))
                || lineX2 == elementWidth && lineY2 == Math.round(element.cy)){
                v.line.remove();
                v.arrowhead ? v.arrowhead.remove() : null;
                v.text ? v.text.remove() : null;
                relationShips = relationShips.filter((l) => l.line.id !== v.line.id
                    && l.line.removed !== true);
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

    if ((event.metaKey || event.ctrlKey) && event.key === "d" && selectedItem) {
        event.preventDefault();
        const image = selectedItem.children().find((v) => v.attr('type') !== imageType.TEXT);
        const element = document.querySelector(`img[type="${image.attr('type')}"]`);
        currentDragItem = element;
        const bbox = selectedItem.getBBox();
        addAdditionalItems({
            x: bbox.x,
            y: bbox.y + 120
        }, currentDragItem.getAttribute('type'));
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
    if (!selectedItem){
        return;
    }
    selectedItem.attr({
        selected: true
    });
    if(resizeHandle){
        resizeHandle.remove();
        rotateHandle.remove();
    }
    enableRotateAndResize(selectedItem);
}

function downloadXml(){
    const svgElements = svg.select("g[type='main']");
    let allElements = svgElements.children()
        .filter((v) => v.children().length === 2);

    const isAdditionalExist = svgElements.children()
        .filter((v) => v.children().length > 2);
    if (isAdditionalExist){
        let arrays = [];
        svgElements.children()
            .filter((v) => v.children().length > 2).forEach((p) => {
            const elements = p.children().filter((v) => v.children().length > 0)
                .map((v) => v);
            arrays.push(...elements);
            });
        allElements.push(...arrays);
    } else {
        allElements.push(...svgElements.children());
    }

    const system = svg.select('image[type="SYSTEM"]');
    if(!system){
        allElements.unshift(system.parent());
    } else {
        allElements = allElements.filter((v) => v.id !== system.parent().id);
        allElements.unshift(system.parent());
    }
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

let cx, cy;

function onStart() {
    if(resizeHandle){
        resizeHandle.remove();
        rotateHandle.remove();
    }
    this.data('ot', this.transform().local);
}

function onMove(dx, dy, x, y, image) {
    let t = image.data('ot');
    image.attr({
        transform: t + (t ? "T" : "t") + [dx, dy],
    });
    generateDashedLines();

}

function onEnd() {
    isDragging = false;
    selectedItem = null;
    reDrawLines();
}

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

function onResizeStart(bbox, image) {
    image.data("ot", bbox);
}

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

function onResizeEnd() {
    resizeHandle.remove();
}
document.addEventListener("click", () => {
    contextMenu.classList.add("hidden");
});
