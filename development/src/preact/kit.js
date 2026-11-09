// Preact-фундамент Home Panel 3.0: единая точка импорта для всех компонентов.
import {h,render} from 'preact';
import {useEffect,useState,useCallback,useRef} from 'preact/hooks';
import htm from 'htm';
export {h,render,useEffect,useState,useCallback,useRef};
export const html=htm.bind(h);
