const finalContainer = document.getElementById('finalOutput');
const finalCanvas = document.getElementById('finalCanvas');
const finalCtx = finalCanvas.getContext('2d');
const downloadButton = document.getElementById('downloadButton');

class RadioInput {
  constructor(name, onChange) {
    this.inputs = document.querySelectorAll(`input[name=${name}]`);
    for (let input of this.inputs) {
      input.addEventListener('change', onChange);
    }
  }

  get value() {
    for (let input of this.inputs) {
      if (input.checked) {
        return input.value;
      }
    }
  }
}

class Input {
  constructor(id, onChange) {
    this.input = document.getElementById(id);
    this.input.addEventListener('change', onChange);
    this.valueAttrib = this.input.type === 'checkbox' ? 'checked' : 'value';
  }

  get value() {
    return this.input[this.valueAttrib];
  }
}

function removeChildren(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

const mimeType = {
  'jpg': 'image/jpeg',
  'png': 'image/png'
};

function getDataURL(imgData, extension) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = imgData.width;
  canvas.height = imgData.height;
  ctx.putImageData(imgData, 0, 0);
  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(URL.createObjectURL(blob)), mimeType[extension], 0.92);
  });
}

const dom = {
  imageInput: document.getElementById('imageInput'),
  faces: document.getElementById('faces'),
  generating: document.getElementById('generating')
};

dom.imageInput.addEventListener('change', loadImage);
downloadButton.addEventListener('click', () => {
  const url = finalCanvas.toDataURL(mimeType[settings.format.value]);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cubemap.${settings.format.value}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
});

const settings = {
  cubeRotation: new Input('cubeRotation', loadImage),
  interpolation: new RadioInput('interpolation', loadImage),
  format: new RadioInput('format', loadImage),
};

const facePositions = {
  pz: {x: 1, y: 1}, // Front
  nz: {x: 2, y: 0}, // Back
  px: {x: 2, y: 1}, // Right
  nx: {x: 0, y: 1}, // Left
  py: {x: 1, y: 0}, // Top
  ny: {x: 0, y: 0} // Bottom
};

function loadImage() {
  const file = dom.imageInput.files[0];

  if (!file) {
    return;
  }

  const img = new Image();
  img.src = URL.createObjectURL(file);

  img.addEventListener('load', () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height);
    processImage(data);
  });
}

let finishedCount = 0;
let workers = [];
let faceData = {};

function processImage(data) {
  removeChildren(dom.faces);
  dom.generating.style.visibility = 'visible';
  finishedCount = 0;
  workers.forEach(worker => worker.terminate());
  workers = [];
  faceData = {};

  // Update final canvas dimensions
  const faceSize = 1024;
  finalCanvas.width = 3 * faceSize;
  finalCanvas.height = 2 * faceSize;
  finalCtx.clearRect(0, 0, finalCanvas.width, finalCanvas.height);
  finalContainer.appendChild(finalCanvas);

  for (let [faceName, position] of Object.entries(facePositions)) {
    const worker = new Worker('convert.js');
    workers.push(worker);

    worker.onmessage = ({data: imageData}) => {
      faceData[faceName] = imageData;
      finishedCount++;
      if (finishedCount === 6) {
        stitchFaces();
      }
    };

    worker.postMessage({
      data: data,
      face: faceName,
      rotation: Math.PI * settings.cubeRotation.value / 180,
      interpolation: settings.interpolation.value,
    });
  }
}

function stitchFaces() {
  const faceSize = 1024;
  for (let [faceName, position] of Object.entries(facePositions)) {
    finalCtx.putImageData(faceData[faceName], position.x * faceSize, position.y * faceSize);
  }
  dom.generating.style.visibility = 'hidden';
  downloadButton.style.display = 'block'; // Show download button
}