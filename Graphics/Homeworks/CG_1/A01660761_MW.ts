/**
 * Manuel Montero Martínez - A01660761
 * 
 * This is a WebGL project that draws a simple representation of the 
 * character Mike Wazowski from the movie Monsters, Inc. 
 * The project uses TypeScript and the twgl.js library to handle WebGL 
 * operations. The face and eyes of the character are created using 
 * triangles, and transformations such as translation, rotation, and 
 * scaling can be applied to the face using a GUI.
 * 
 * NOTE: This code was mainly based on the examples available in this 
 * course's repository. I used ChatGPT-6.1 Sol to assist me by explaining 
 * to me most of the functions and implementations that were required to 
 * finish the project. Specifically when it came to the whole vector and 
 * matrix math, in regards to their implementation and how to use them to 
 * create the transformations. Also because I wasn't familiar with the 
 * implementations of the controls in the GUI.
 * 
 * There were no automatic or Copy-Paste solutions throughout the code 
 * by the AI at all. The only copies were from the original examples in the 
 * repository, like the shaders and the twgl.js library.
 * 
 */

/// <reference types="vite/client" />

'use strict';

import * as twgl from "twgl-base.js";

import vsGLSL from "./vs_matrices_vcolor.glsl?raw";
import fsGLSL from "./fs_vertex_color.glsl?raw";
import { V2, M3 } from "./2d-lib.js";
import GUI from "lil-gui";

function createFace(radius: number): twgl.Arrays {
    const positions: number[] = [];
    const colors: number[] = [];

    const green = [0.50, 0.76, 0.16, 1];
    const segments = 40; // each slice takes 9 degrees (360 / 40 = 9)

    for (let i = 0; i < segments; i++) {
        // multiplying by 2 * Math.PI converts the segment index to an angle in radians
        const angleA = (i / segments) * 2 * Math.PI;
        const angleB = ((i + 1) / segments) * 2 * Math.PI;

        positions.push(
            0, 0,
            radius * Math.cos(angleA), radius * Math.sin(angleA),
            radius * Math.cos(angleB), radius * Math.sin(angleB)
        ); // triangle vertices

        colors.push(...green, ...green, ...green);
    }

    // define the mouth parameters
    const mouthY = -radius * 0.65;
    const mouthRadiusX = radius * 0.25;
    const mouthRadiusY = radius * 0.12;
    const mouthColor = [0.03, 0.03, 0.02, 1];

    for (let i = 0; i < segments; i++) {
        const angleA = (i / segments) * 2 * Math.PI;
        const angleB = ((i + 1) / segments) * 2 * Math.PI;

        positions.push(
            0, mouthY,
            mouthRadiusX * Math.cos(angleA),
            mouthY + mouthRadiusY * Math.sin(angleA),
            mouthRadiusX * Math.cos(angleB),
            mouthY + mouthRadiusY * Math.sin(angleB)
        ); // triangle vertices for the mouth

        colors.push(...mouthColor, ...mouthColor, ...mouthColor);
    }

    return {
        a_position: {
            numComponents: 2,
            data: positions,
        },
        a_color: {
            numComponents: 4,
            data: colors,
        },
    }; // vertex attributes for the face (to be retrieved by the shader file)
}

function createEye(radius: number): twgl.Arrays {
    const positions: number[] = [];
    const colors: number[] = [];
    const segments = 40;

    const layers = [
        { radius: radius, color: [0.96, 0.97, 0.90, 1] },
        { radius: radius * 0.45, color: [0.05, 0.50, 0.36, 1] },
        { radius: radius * 0.22, color: [0.01, 0.02, 0.02, 1] },
    ]; // define the layers of the eye: sclera, iris, and pupil (yes, I had to search for the correct terms)

    for (const layer of layers) {
        for (let i = 0; i < segments; i++) {
            const angleA = (i / segments) * 2 * Math.PI;
            const angleB = ((i + 1) / segments) * 2 * Math.PI;

            positions.push(
                0, 0,
                layer.radius * Math.cos(angleA),
                layer.radius * Math.sin(angleA),
                layer.radius * Math.cos(angleB),
                layer.radius * Math.sin(angleB)
            );

            colors.push(...layer.color, ...layer.color, ...layer.color);
        }
    } // goes through each layer of the eye and creates the triangles for each segment

    return {
        a_position: {
            numComponents: 2,
            data: positions,
        },
        a_color: {
            numComponents: 4,
            data: colors,
        },
    };
}

function main(): void {
    const canvas = document.querySelector<HTMLCanvasElement>("#canvas");

    if (!canvas) {
        throw new Error("Canvas not found.");
    }

    const gl = canvas.getContext("webgl2");

    if (!gl) {
        throw new Error("WebGL 2 not available.");
    }

    twgl.resizeCanvasToDisplaySize(canvas);
    gl.viewport(0, 0, canvas.width, canvas.height); // match the viewport to the canvas size

    const programInfo = twgl.createProgramInfo(gl, [vsGLSL, fsGLSL]);

    if (!programInfo) {
        throw new Error("Failed to create program info.");
    }

    const faceArrays = createFace(130); // with a radius of 130 pixels
    const faceBuffer = twgl.createBufferInfoFromArrays(gl, faceArrays);
    const faceVAO = twgl.createVAOFromBufferInfo(gl, programInfo, faceBuffer);
    const eyeArrays = createEye(55);
    const eyeBuffer = twgl.createBufferInfoFromArrays(gl, eyeArrays);
    const eyeVAO = twgl.createVAOFromBufferInfo(gl, programInfo, eyeBuffer);

    const face = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        angle: 0,
        scaleX: 1,
        scaleY: 1,
    };

    const pivot = {
        x: canvas.width / 2,
        y: canvas.height / 2 + 35,
    }; // saves the poition of the center of the eye

    const drawScene = (): void => {
        const angleRadians = face.angle * Math.PI / 180; // turn degrees into radians for the rotation matrix

        const scaleMatrix = M3.scale(
            V2.create(face.scaleX, face.scaleY)
        );

        const translateMatrix = M3.translation(
            V2.create(face.x, face.y)
        );

        const pivotToOrigin = M3.translation(
            V2.create(-pivot.x, -pivot.y)
        );

        const rotateMatrix = M3.rotation(angleRadians); // the angle of rotation in radians
        const originToPivot = M3.translation(
            V2.create(pivot.x, pivot.y)
        );

        // create a composite transform matrix for all face forms
        let faceMatrix = M3.multiply(translateMatrix, scaleMatrix);
        faceMatrix = M3.multiply(pivotToOrigin, faceMatrix);
        faceMatrix = M3.multiply(rotateMatrix, faceMatrix);
        faceMatrix = M3.multiply(originToPivot, faceMatrix);

        const eyeMatrix = M3.translation(
            V2.create(pivot.x, pivot.y)
        ); // the eye is not affected by any transformations, so it only needs to be translated to the pivot position

        gl.clearColor(0.04, 0.15, 0.12, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(programInfo.program);

        twgl.setUniforms(programInfo, {
            u_resolution: [canvas.width, canvas.height],
            u_transforms: faceMatrix,
        });

        gl.bindVertexArray(faceVAO);
        twgl.drawBufferInfo(gl, faceBuffer, gl.TRIANGLES);

        twgl.setUniforms(programInfo, {
            u_transforms: eyeMatrix,
        });

        gl.bindVertexArray(eyeVAO);
        twgl.drawBufferInfo(gl, eyeBuffer, gl.TRIANGLES);
    };

    const gui = new GUI(); // create a GUI to interact with the face and pivot transformations
    const translationFolder = gui.addFolder("Face translation");
    translationFolder.add(face, "x", 0, canvas.width, 1);
    translationFolder.add(face, "y", 0, canvas.height, 1);

    const rotationFolder = gui.addFolder("Face rotation");
    rotationFolder.add(face, "angle", 0, 360, 1).name("Degrees");

    const scaleFolder = gui.addFolder("Face scale");
    scaleFolder.add(face, "scaleX", 0.2, 3, 0.01).name("X");
    scaleFolder.add(face, "scaleY", 0.2, 3, 0.01).name("Y");

    const pivotFolder = gui.addFolder("Eye / pivot");
    pivotFolder.add(pivot, "x", 0, canvas.width, 1);
    pivotFolder.add(pivot, "y", 0, canvas.height, 1);

    gui.onChange(drawScene); // redraw the scene whenever a GUI control is changed

drawScene(); 

    console.log("WebGL 2 & shaders ready", programInfo.program);
}

main();