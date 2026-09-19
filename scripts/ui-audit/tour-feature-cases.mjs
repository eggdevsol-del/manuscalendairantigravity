// Fixture-only scenarios. Importing this inventory never launches a browser.
import {response as fixture} from './ivory-fixtures.mjs';
const sessionFixture=(changes)=>{const data=fixture('projects.summary','artist');return {...data,sessions:data.sessions.map(session=>({...session,...changes}))};};
const button=(name)=>async page=>page.getByRole('button',{name,exact:typeof name==='string'}).first().click();
const tab=(name)=>async page=>page.getByRole('tab',{name,exact:true}).click();
const studioFixture={
 'studios.getCurrentStudio':{id:'studio-test',name:'Northside Studio',ownerId:'artist-test',role:'owner',stripeSubscriptionId:'sub-test',subscriptionStatus:'active'},
 'studios.getStudioMembers':[{id:'membership-test',status:'active',role:'artist',user:{id:'member-test',name:'Sam Artist',email:'sam@example.test'}}],
 'appointments.getStudioCalendar':[],
};
const shopFixture=fixture('storefront.getArtistStorefront','public');
const shopVariants={...shopFixture,products:shopFixture.products.map(product=>({...product,fulfillmentType:'both',variants:[{id:10,name:'Small',priceCents:4500,inventoryCount:12},{id:11,name:'Large',priceCents:6500,inventoryCount:3}]}))};
const tripFixture={'artistSettings.matchClientsByLocation':{total:1,clients:[{id:'client-test',name:'Mia Chen',city:'Brisbane',country:'Australia'}]},'artistSettings.get':{...fixture('artistSettings.get','artist'),travelDates:JSON.stringify([{id:'trip-test',location:'Brisbane',country:'Australia',startDate:'2026-12-01',endDate:'2026-12-10'}])}};
const waitlistRow={id:1,name:'Mia Chen',conversationId:12,status:'waiting',note:'Any earlier weekday',expired:false};
const csvUpload=async page=>page.locator('input[type=file]').setInputFiles({name:'clients.csv',mimeType:'text/csv',buffer:Buffer.from(['Name,Email,Date,Start time,End time,Service,Price',...Array.from({length:5},(_,index)=>`Fixture ${index},person${index}@example.test,2026-12-18,09:00,12:00,Full day,600`)].join('\n'))});
const importPreview=['new','duplicate','conflict','invalid','failed'].map((status,index)=>({index,sourceRow:index+2,name:'Fixture '+status,status,detail:'Fixture result: '+status}));
const bankFixture={
 'artistSettings.getStripeConnectStatus':{connected:true,statusAvailable:true,accountType:'custom',chargesEnabled:true,payoutsEnabled:true},
 'artistSettings.getPayoutSchedule':{currency:'AUD',availableBalance:60000,pendingBalance:15000,interval:'weekly',weeklyAnchor:'monday',delayDays:2,bankLast4:'1234'}
};
const eventFixture={id:1,title:'Botanical workshop',type:'in_person',date:'2026-12-18T00:00:00Z',locationUrl:'Brisbane studio',description:'Fixture workshop',priceCents:20000,capacity:10,ticketsSold:2};
const legacyProposal={
 'messages.list':[{id:90,conversationId:12,senderId:'artist-test',messageType:'system',content:'Booking proposal',createdAt:'2026-09-09T00:00:00Z',metadata:JSON.stringify({type:'project_proposal',status:'pending',appointmentIds:[101],serviceName:'Full day',serviceDuration:180,sittings:1,totalCost:600,depositAmount:150,dates:['2026-12-18T00:00:00Z']})}],
 'appointments.getByConversation':fixture('appointments.getArtistCalendar','artist'),
};
const supplyFixture={
 'suppliers.getSupplier':{id:1,name:'Studio Supply',currency:'AUD'},
 'suppliers.getSupplierProducts':[{id:1,title:'Needle cartridges',description:'Fixture supplies',category:'Needles',variants:[{id:1,title:'Round liner',priceCents:3200,inventoryCount:10}]}],
 'supplierOrders.getShippingRates':{rates:[{name:'Standard',priceCents:1000,currency:'AUD',minOrderSubtotalCents:null,maxOrderSubtotalCents:null}]},
 'supplierOrders.createSupplierCheckout':{orderId:1,clientSecret:'pi_fixture_secret',subtotalCents:3200,shippingCents:1000,platformFeeCents:500,totalCents:4700,currency:'AUD',supplierCurrency:'AUD',exchangeRate:1}
};
export const cases=[
 {name:'supply-catalogue',path:'/supplies?supplier=1',override:supplyFixture,open:[]},
 {name:'supply-cart',path:'/supplies?supplier=1',override:supplyFixture,open:[button('Add to order'),button('Review order')]},
 {name:'supply-total',path:'/supplies?supplier=1',override:supplyFixture,open:[button('Add to order'),button('Review order'),button('Review checkout total')]},
 {name:'subscription-checkout',path:'/subscriptions',override:{'billing.subscriptionStatus':{tier:'free'},'billing.artistOffer':{priceCents:4900,currency:'AUD',interval:'month'},'billing.createArtistCheckoutSession':{clientSecret:'cs_fixture_secret'}},open:[button('Choose Pro')]},

 ...['in_progress','completed','failed'].map(status=>({name:'instagram-'+status,path:'/settings?section=instagram',override:{'instagram.getLatestImport':{id:1,instagramUsername:'fixture_artist',status,totalDiscovered:10,totalProcessed:5},'instagram.getImportStatus':{id:1,instagramUsername:'fixture_artist',status,totalDiscovered:10,totalProcessed:5}},open:[]})),
 {name:'instagram-lookup',path:'/settings?section=instagram',override:{'instagram.verifyUsername':{success:true,userInfo:{fullName:'Fixture Artist',username:'fixture_artist',mediaCount:10}}},open:[async page=>page.getByLabel('Instagram username',{exact:true}).fill('fixture_artist'),button('Check account')]},
 {name:'tabs-inbox-contacts',path:'/conversations',open:[tab('Contacts')]},
 {name:'tabs-bookings-past',role:'client',path:'/bookings',open:[tab('Past')]},
 ...['Fulfilled','All'].map(name=>({name:'tabs-orders-'+name.toLowerCase(),role:'merchant',path:'/merchant/orders',open:[tab(name)]})),

 {name:'legacy-proposal-review',path:'/chat/12',override:legacyProposal,open:[button('Review proposal')]},
 ...['Contact','Service & cost','Reschedule'].map(name=>({name:'legacy-editor-'+name.toLowerCase().replace(/[^a-z]+/g,'-'),path:'/chat/12',override:legacyProposal,open:[button('Review proposal'),button('Edit Booking'),tab(name)]})),

 {name:'request-archive',path:'/lead/1',open:[button('Archive request')]},
 {name:'request-consultation',path:'/settings?section=consultations',override:{'consultations.list':[{id:1,subject:'Botanical enquiry',description:'Fixture consultation details',status:'pending',client:{name:'Mia Chen'},clientId:'client-test',artistId:'artist-test',conversationId:12}]},open:[button(/^Botanical enquiry/)]},

 {name:'discover-profile',role:'client',path:'/discover',open:[button('View artist')]},
 {name:'discover-enquiry',role:'client',path:'/discover',open:[button('View artist'),button('Request consultation')]},
 {name:'event-list',role:'public',path:'/events/ella-morgan',override:{'storefront.getPublicSeminars':[eventFixture]},open:[]},
 {name:'event-registration',role:'public',path:'/events/ella-morgan',override:{'storefront.getPublicSeminars':[eventFixture],'storefront.createSeminarCheckout':{orderId:1,sessionId:'cs_fixture',clientSecret:'cs_fixture_secret',totalCents:20500}},open:[button('Review registration')]},
 {name:'event-confirmation',role:'public',path:'/events/ella-morgan?order_id=1&session_id=cs_fixture',override:{'storefront.getPublicSeminars':[eventFixture],'storefront.getOrderStatus':{status:'paid',orderId:1,fulfillmentMethod:'digital',totalCents:20500}},open:[]},

 {name:'import-results',expected:'already been imported',path:'/settings?section=data-import',override:{'dataImport.preview':importPreview,'dataImport.commit':{rows:[{...importPreview[0],status:'imported',detail:'Client created'},{...importPreview[4],status:'failed',detail:'Fixture retry failure'}]}},open:[csvUpload,button('Review matches & duplicates'),button('Import / retry 2 ready rows')]},

 {name:'bank-disconnect',path:'/bank-payouts',override:bankFixture,open:[button('Disconnect payment account')]},
 {name:'bank-account-setup',expected:'identity and bank checks',path:'/bank-payouts',override:bankFixture,open:[button('Review account details')]},
 {name:'portfolio-preview',expected:'Review this saved image',path:'/artist-profile',open:[tab('Portfolio'),button('View Botanical study')]},
 {name:'portfolio-remove',path:'/artist-profile',open:[tab('Portfolio'),async page=>page.getByRole('checkbox',{name:'Select Botanical study'}).check(),button('Remove selected')]},

 {name:'waitlist-offer',path:'/waitlist',override:{'waitlist.list':[waitlistRow]},open:[button('Offer a time')]},
 {name:'waitlist-withdraw',path:'/waitlist',override:{'waitlist.list':[waitlistRow]},open:[button('Withdraw')]},
 {name:'waitlist-client-offer',role:'client',path:'/waitlist',override:{'waitlist.list':[{...waitlistRow,name:'Ella Morgan',status:'offered',startsAt:'2026-12-18T00:00:00Z',durationMinutes:180,estimateCents:60000,depositCents:15000,expiresAt:'2026-12-17T00:00:00Z'}]},open:[]},
 {name:'waitlist-client-leave',role:'client',path:'/waitlist',override:{'waitlist.list':[waitlistRow]},open:[button('Leave waitlist')]},
 {name:'waitlist-deposit',role:'client',path:'/waitlist',override:{'waitlist.list':[{...waitlistRow,status:'accepted',planStatus:'pending',sessionPlanId:11}]},open:[button('Continue to deposit')]},
 {name:'import-client-mapping',path:'/settings?section=data-import',open:[csvUpload]},
 {name:'import-appointment-mapping',path:'/settings?section=data-import',open:[async page=>page.getByLabel('What are you importing?',{exact:true}).selectOption('appointments'),csvUpload]},
 {name:'import-preview',expected:'duplicates are skipped',path:'/settings?section=data-import',override:{'dataImport.preview':importPreview},open:[csvUpload,button('Review matches & duplicates')]},

 ...[['edit','Edit trip'],['remove','Remove'],['clients','Find clients']].map(([name,label])=>({name:'confirmation-trip-'+name,path:'/settings?section=travel',override:tripFixture,open:[button(label)]})),
 {name:'confirmation-template-edit',path:'/settings?section=notifications',override:{'notifications.list':[{id:1,title:'Preparation message',content:'Prepare for your appointment',templateType:'preparation',enabled:true,timing:'before'}]},open:[button(/^Preparation message/)]},
 ...['Clear all resolved reports','Clear resolved reports older than 30 days'].map((label,index)=>({name:'confirmation-errors-'+index,role:'admin',path:'/admin/errors',open:[button(label)]})),

 {name:'commerce-product',role:'public',path:'/shop/ella-morgan',override:{'storefront.getArtistStorefront':shopVariants},open:[button('View Botanical art print')]},
 {name:'commerce-product-description',role:'public',path:'/shop/ella-morgan',override:{'storefront.getArtistStorefront':shopVariants},open:[button('View Botanical art print'),async page=>page.getByText('About this product',{exact:true}).click()]},
 {name:'commerce-cart',role:'public',path:'/shop/ella-morgan',override:{'storefront.getArtistStorefront':shopVariants},open:[button('View Botanical art print'),button('Add to cart')],expected:'platform fee'},
 {name:'commerce-in-stock',role:'public',path:'/shop/ella-morgan',open:[tab('In stock')]},
 {name:'commerce-refund',path:'/payout-history',open:[button('Review refund')]},

 {name:'map-overview',role:'client',path:'/discover',open:[button('Your artists and bookings'),button(/See Artist Map/)]},
 {name:'forms-consent-signature',role:'client',path:'/projects/12?session=101&action=forms',override:{'forms.getPendingForms':[{id:7,title:'Procedure consent',content:'Review the procedure information.',formType:'procedure_consent',status:'pending'}]},open:[button('Continue to signature')],expected:'clears the strokes'},

 ...['Medical','Consent'].map(name=>({name:'forms-template-'+name.toLowerCase(),path:'/settings?section=regulation',open:[tab(name)]})),
 {name:'forms-procedure-record',path:'/settings?section=regulation',override:{'forms.getProcedureLogs':[{id:1,clientName:'Mia Chen',artistLicenceNumber:'TEST',date:'2026-09-10',appointmentId:101,amountPaid:60000,paymentMethod:'card'}]},open:[button(/^Mia Chen/)]},
 {name:'forms-consent-review',role:'client',path:'/projects/12?session=101&action=forms',override:{'forms.getPendingForms':[{id:7,title:'Procedure consent',content:'Read the procedure information before signing.',formType:'consent',status:'pending'}]},open:[]},
 {name:'forms-medical-review',role:'client',path:'/projects/12?session=101&action=forms',override:{'forms.getPendingForms':[{id:7,title:'Medical release',content:'1. Do you have allergies?\n2. Do you take medication?',formType:'medical_release',status:'pending'}]},open:[]},
 ...['Schedule','Team','Billing'].map(name=>({name:'studio-'+name.toLowerCase(),path:'/studio?view='+name,override:studioFixture,open:[]})),
 {name:'studio-remove',path:'/studio?view=Team',override:studioFixture,open:[button('Remove')]},
 {name:'checkout-deposit-review',role:'client',path:'/projects/12?session=101',override:{'projects.summary':sessionFixture({sessionPlanId:11,projectName:'Botanical sleeve'})},open:[button(/^Review.*deposit/)]},
 {name:'checkout-balance-review',role:'client',path:'/projects/12?session=101',open:[button('Review balance')]},

 {name:'artwork-viewer',role:'client',path:'/discover',override:{'portfolio.list':[{id:1,imageUrl:'/__ivory_artwork.png',description:'Botanical study',mediaType:'image'},{id:2,imageUrl:'/__ivory_artwork.png',description:'Second study',mediaType:'image'}]},open:[button('Your artists and bookings'),button("View Ella Morgan's portfolio"),button('View Botanical study')],expected:'Display the next piece'},

 {name:'session-finish-paid',path:'/projects/12?session=101',override:{'projects.summary':sessionFixture({paidCents:60000,remainingCents:0})},open:[button('Finish session')],expected:'record the current finish time'},
 {name:'session-cancel-plan',path:'/projects/12?session=101',override:{'projects.summary':sessionFixture({sessionPlanId:11})},open:[async page=>page.getByText('More session options',{exact:true}).click(),button('Cancel session'),async page=>page.getByRole('checkbox').check()],expected:'Cancel all remaining sessions in this plan.'},
 {name:'session-cancel-single',path:'/projects/12?session=101',override:{'projects.summary':sessionFixture({sessionPlanId:11})},open:[async page=>page.getByText('More session options',{exact:true}).click(),button('Cancel session')],expected:'Cancel only this session.'},

 ...['Bookings','Forms','Notes'].map(name=>({name:'record-'+name.toLowerCase(),path:'/clients?client=client-test',open:[tab(name)]})),
 {name:'record-sitting',path:'/clients?client=client-test',open:[async page=>page.locator('[data-tour-repeat="sitting-disclosure"]').first().click()]},
 ...[
  ['reschedule',[button('Reschedule')]],
  ['finish',[button('Finish session')]],
  ['cancel',[async page=>page.getByText('More session options',{exact:true}).click(),button('Cancel session')]],
  ['no-show',[async page=>page.getByText('More session options',{exact:true}).click(),button('Mark no-show')]],
 ].map(([name,open])=>({name:'session-'+name,path:'/projects/12?session=101',open})),

 {name:'add-client',expected:'Save the entered name',path:'/clients',open:[button('Add client')]},
 {name:'services-tab',path:'/work-hours',open:[tab('Services')]},
 {name:'add-service',path:'/work-hours',open:[tab('Services'),button('Add service')]},
 {name:'edit-service',path:'/work-hours',open:[tab('Services'),button(/^Full day/)]},
 {name:'portfolio-tab',path:'/artist-profile',open:[tab('Portfolio')]},
 {name:'portfolio-upload',path:'/artist-profile',open:[tab('Portfolio'),button('Add photo')]},
 {name:'product-create',path:'/products',open:[button('Add product')]},
 {name:'product-edit',path:'/products',open:[button(/^Edit /)]},
 {name:'event-create',path:'/artist-events',open:[button('Create event')]},
 {name:'trip-create',path:'/settings?section=travel',open:[button('Add trip')]},
 {name:'template-create',path:'/settings?section=notifications',open:[button('Add template')]},
 {name:'booking-client',path:'/calendar',open:[button('New booking')]},
 {name:'booking-service',path:'/calendar',open:[button('New booking'),button(/^Mia Chen/)]},
 {name:'booking-frequency',path:'/calendar',open:[button('New booking'),button(/^Mia Chen/),button(/^Full day/),button('Find dates automatically')]},
 {name:'booking-details',path:'/calendar',open:[button('New booking'),button(/^Mia Chen/),button(/^Full day/)]},
 {name:'booking-review',path:'/calendar',open:[button('New booking'),button(/^Mia Chen/),button(/^Full day/),async page=>page.locator('input[type=date]').fill('2026-12-18'),button('Review proposal')]},
 {name:'thread-details',path:'/chat/12',open:[button('Client details and media')]},
 {name:'thread-booking',path:'/chat/12',open:[button('Book')]},
 {name:'project-overview',path:'/projects/12',open:[]},
 ...['Messages','Files','Payments'].map(name=>({name:'project-'+name.toLowerCase(),path:'/projects/12',open:[tab(name)]})),
 {name:'client-project',role:'client',path:'/projects/12',open:[]},
 {name:'supplier-product-create',role:'merchant',path:'/merchant/products',open:[button('Add product')]},
 {name:'supplier-product-edit',role:'merchant',path:'/merchant/products',open:[button(/^Edit /)]},
];
