import {expect,it} from 'vitest';
import {describeControl,describeSurface} from './tourCopy';
it.each([
 ['Save payout schedule','Apply the changes'],
 ['Pay deposit','platform fee'],
 ['Show password','Show or conceal'],
 ['Send message','real message'],
 ['Remove session 2','sittings in this draft'],
 ['Review refund','refund preview'],
 ['Find available dates','working hours'],
 ['Copy link','saved public link'],
 ['Clear signature','clears the strokes'],
 ['Continue to signature','does not sign or submit'],
])('explains %s without confusing its meaning',(label,expected)=>{
 const button=document.createElement('button');button.textContent=label;
 expect(describeControl(button,'Booking')).toContain(expected);
});
it('does not describe payment history as a payment authorisation',()=>{
 const link=document.createElement('a');link.textContent='Payment history';link.href='/payout-history';
 expect(describeControl(link,'Money')).not.toContain('authorise');
});

it('explains radio answers in the context of their medical question',()=>{
 const fieldset=document.createElement('fieldset');
 fieldset.innerHTML='<legend>Do you have allergies?</legend><label>Yes<input type="radio" name="allergies"></label>';
 const copy=describeControl(fieldset.querySelector('input')!,'Medical release');
 expect(copy).toContain('Do you have allergies?');
 expect(copy).toContain('Select yes');
 expect(copy).not.toContain('Enter yes');
});

it('distinguishes bank verification from authorising a client payment',()=>{
 const copy=describeSurface('Set up your payment account');
 expect(copy).toContain('identity and bank checks');
 expect(copy).not.toContain('before authorising payment');
});
