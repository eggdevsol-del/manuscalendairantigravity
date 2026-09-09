import {describe,it,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
vi.mock('@/lib/stripe',()=>({stripePromise:Promise.resolve({})}));
vi.mock('@/features/stripe/EmbeddedStripeCheckout',()=>({EmbeddedStripeCheckout:()=> <div>Embedded Checkout session</div>}));
vi.mock('@stripe/react-stripe-js',()=>({Elements:()=> <div>PaymentIntent Elements</div>,PaymentElement:()=>null,useStripe:()=>null,useElements:()=>null}));
import {DotsCheckout} from './DotsCheckout';
afterEach(cleanup);
describe('Stripe checkout integration selection',()=>{
 it('uses Embedded Checkout for a supplier Checkout Session secret',()=>{render(<DotsCheckout clientSecret="cs_test_session_secret_test" amountCents={10000} onComplete={()=>{}}/>);expect(screen.getByText('Embedded Checkout session')).toBeTruthy();expect(screen.queryByText('PaymentIntent Elements')).toBeNull();});
 it('keeps deposit PaymentIntents on the Payment Element integration',()=>{render(<DotsCheckout clientSecret="pi_test_secret_test" amountCents={10000} onComplete={()=>{}}/>);expect(screen.getByText('PaymentIntent Elements')).toBeTruthy();expect(screen.queryByText('Embedded Checkout session')).toBeNull();});
});
