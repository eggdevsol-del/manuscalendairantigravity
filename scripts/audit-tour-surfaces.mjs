import ts from 'typescript';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {scanOverlays} from './check-overlays.js';
const root=process.cwd(),graph=scanOverlays(root),surfaces=[];
for(const file of graph.files.filter(file=>file.endsWith('.tsx'))) {
 const source=ts.createSourceFile(file,readFileSync(path.resolve(root,file),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 function visit(node) {
  if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node)) {
   const kind=node.tagName.getText(source);
   const attributes=node.attributes.properties.filter(ts.isJsxAttribute);
   const role=attributes.find(prop=>prop.name.getText(source)==='role')?.initializer;
   const explicitSurface=attributes.some(prop=>prop.name.getText(source)==='data-tour-surface');
   const dialogRole=role&&ts.isStringLiteral(role)&&['dialog','alertdialog'].includes(role.text);
   if(['Screen','SheetShell','ModalShell','Tabs','DialogContent','SheetContent','Dialog.Content','DialogPrimitive.Content','AlertDialog.Content'].includes(kind)||explicitSurface||dialogRole) {
    const attr=node.attributes.properties.find(prop=>ts.isJsxAttribute(prop)&&['title','label','aria-label'].includes(prop.name.getText(source)));
    surfaces.push({file,line:source.getLineAndCharacterOfPosition(node.pos).line+1,kind,label:attr?.initializer?.getText(source)||'(dynamic/composed)',key:node.attributes.properties.find(prop=>ts.isJsxAttribute(prop)&&prop.name.getText(source)==='overlayId')?.initializer?.getText(source)});
   }
  }
  ts.forEachChild(node,visit);
 }
 visit(source);
}
mkdirSync('output/tattoi-complete-tours',{recursive:true});
writeFileSync('output/tattoi-complete-tours/source-surfaces.json',JSON.stringify(surfaces,null,2));
console.log(`${graph.modules} reachable modules; ${surfaces.length} page, tab and overlay declarations inventoried.`);
for(const row of surfaces) console.log(`${row.file}:${row.line} ${row.kind} ${row.label}`);
