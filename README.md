# Minimal Repro - Apollo Client + Styled Components + SSR duplication

## Summary

Under the following conditions, `styled-components` will create duplicate global styles during Server-Side Rendering:

1. App implements SSR stragies from both `styled-components` and `@apollo/client`
1. App has at least one `useQuery` call
1. App has at least one `createGlobalStyle` component in the tree

## Minimal App

The application in [`test.js`](./test.js) is a minimal React application with:

1. One component created with [`createGlobalStyle`](https://styled-components.com/docs/api#createglobalstyle)
1. One component created with `styled.div`
1. One component that makes a [`useQuery`](https://www.apollographql.com/docs/react/data/queries/#usequery-api) call
1. `styled-components` SSR support via `ServerStyleSheet`/`collectStyles`/`getStyleTags`/`babel-plugin-styled-components`
1. `@apollo/client` SSR support via [`getMarkupFromTree`](https://www.apollographql.com/docs/react/performance/server-side-rendering/)

## Test Cases w/ SSR Output (can be generated with `npm start`)

### styled-components + apollo + ssr default setup:

This is the barebones Apollo + Styled Components setup, to help illustrate the bug. Note that there are 2 copies of the `html` element styles in the SSR output, but there should only be one.

```html
<html>
  <style data-styled="true" data-styled-version="5.3.3">
    .kERQPB {
      position: relative;
    } /*!sc*/
    data-styled.g1[id='sc-bdvvtL'] {
      content: 'kERQPB,';
    } /*!sc*/
    html {
      display: block;
    } /*!sc*/
    data-styled.g2[id='sc-global-dxkSA1'] {
      content: 'sc-global-dxkSA1,';
    } /*!sc*/
    html {
      display: block;
    } /*!sc*/
    data-styled.g3[id='sc-global-dxkSA2'] {
      content: 'sc-global-dxkSA2,';
    } /*!sc*/
  </style>
  <div class="sc-bdvvtL kERQPB">response from GraphQL server</div>
</html>
```

### With temporary hack:

This is the barebones setup from the first test case, but with a hack! The code hooks into Apollo Client's `getMarkupFromTree` and, before each React render, resets the global styles (`gs`) object on the `ServerStyleSheet` so it's empty. The idea is that we only care about CSS for the _very last_ render, so we'll ignore the global styles until the end.

This hack is far from perfect. Although the global _declarations_ are not duplicated, there's still superfluous output (note the 1 extra `data-styled.g*` class).

```html
<html>
  <style data-styled="true" data-styled-version="5.3.3">
    .kERQPB {
      position: relative;
    } /*!sc*/
    data-styled.g1[id='sc-bdvvtL'] {
      content: 'kERQPB,';
    } /*!sc*/
    html {
      display: block;
    } /*!sc*/
    data-styled.g2[id='sc-global-dxkSA1'] {
      content: 'sc-global-dxkSA1,';
    } /*!sc*/
  </style>
  <div class="sc-bdvvtL kERQPB">response from GraphQL server</div>
</html>
```

## Why?

I believe the issue is a disconnect between how Apollo Client's `getMarkupFromTree`/`getDataFromTree` works, and how `styled-components` expects SSR to work.

Apollo Client works by calling `ReactDOMServer.renderToString` _many_ times in a row. This is necessary because there's no way to figure out ahead of time how many `useQuery` calls are nested in the component tree.

However, `styled-components` expects to only run through `renderToString` _once_. Ideally, we'd only generate styles on the _very last_ call to `renderToString`. However, due to the architecture of Apollo Client, there is no way to know how many React renders will be necessary.

## How can Styled-Components address this?

I believe a minimal fix is possible if the `ServerStyleSheet` in `styled-components` provided an API to clear/reset the stylesheet.

When using Apollo Client w/ SSR, you only use the markup from the _final_ render. Ideally, we'd also just capture styles from the final render.
