const express = require('express');
const { initTRPC } = require('@trpc/server');
const trpcExpress = require('@trpc/server/adapters/express');

const t = initTRPC.create();
const appRouter = t.router({
  hello: t.procedure.query(() => 'world'),
});

const app = express();
app.use('/trpc', trpcExpress.createExpressMiddleware({ router: appRouter }));

app.listen(3002, () => console.log('Listening on 3002'));
