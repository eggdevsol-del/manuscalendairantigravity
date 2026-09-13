# Contextual tours — 3.2.2

Restores one shared original-style spotlight and floating tooltip for both legacy tours and the current artist, client and supplier guides. Removes the static V3 guide overlay and its CSS.

Steps resolve actual controls after navigation, move alongside them, scroll them into view and remeasure during scrolling/resizing. Tooltip dimensions and placement respect safe areas, the visual viewport and bottom navigation. The page remains interactive; tours never click, submit, send or pay automatically. Missing targets show an explicit waiting state, with Skip available, rather than highlighting an unrelated header.

Adds Back, Escape dismissal, skip without completion, replay and completion persistence. Cancelling prevents delayed callbacks from advancing a dismissed tour. Restores current guide targets and corrects obsolete supplier product/fulfilment editing instructions to the Shopify workflow.

Access: Settings → Guided walkthroughs (supplier: Account settings). Some later steps require the user to open a conversation, select a record, progress through the booking wizard or have the relevant account capability. These conditional steps are not a claim of exhaustive contextual coverage of every app feature.

Validation: TypeScript, production build, regression suite and nine browser cases (artist/client/supplier at 440/820/1180 widths), testing target movement, Back, Skip, replay and completion. Tests use local fixtures, not live business actions.
