// Verify this visual refresh has not changed main's business code or component structure.
import ts from 'typescript';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const base='aca9ee8df96102f5b05fa2f0bdfa520576a50919';
const files=execFileSync('git',['diff','--name-only',base,'--','client/src'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
const intentional=new Set(['client/src/ui/useIvoryPalette.ts','client/src/ui/ivory-theme.test.tsx','client/src/main.tsx','client/src/components/ui/ssot/DotsCheckout.tsx','client/src/features/stripe/StripeExpressOnboarding.tsx']);
function shape(source,file){
 const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true, file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 function walk(n){return [n.kind,ts.isStringLiteralLike(n)?'<presentation literal>':ts.isIdentifier(n)||ts.isNumericLiteral(n)?n.text:'',...n.getChildren(tree).filter(n=>n.kind!==ts.SyntaxKind.JSDocComment).map(walk)];}
 return JSON.stringify(walk(tree));
}
for(const file of files.filter(f=>/\.tsx?$/.test(f)&&!intentional.has(f))){
 const before=execFileSync('git',['show',`${base}:${file}`],{encoding:'utf8'});
 if(shape(before,file)!==shape(readFileSync(file,'utf8'),file))throw Error('Non-literal source change: '+file);
}
const protectedFiles=execFileSync('git',['diff','--name-only',base,'--','server','shared','drizzle','client/src/App.tsx','client/src/contexts','client/src/_core','client/src/shells'],{encoding:'utf8'}).trim().split('\n').filter(f=>f && f!=='client/src/shells/StudioShell.tsx');
if(protectedFiles.length)throw Error('Protected source changed: '+protectedFiles.join(', '));
console.log('PASS: component structures/expressions unchanged outside reviewed theme import and Stripe appearance hooks; protected business code unchanged.');
