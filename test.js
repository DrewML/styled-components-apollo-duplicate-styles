const React = require('react');
const { format } = require('prettier');
const { default: styled } = require('styled-components');
const { ServerStyleSheet, createGlobalStyle } = require('styled-components');
const { renderToString } = require('react-dom/server');
const { gql, useQuery } = require('@apollo/client');
const { MockedProvider } = require('@apollo/client/testing');
const { getMarkupFromTree } = require('@apollo/client/react/ssr');

const GRAPHQL_QUERY = gql`
  query {
    hello {
      world
    }
  }
`;

// Setup some mocks so we don't need
// a real GraphQL server to replicate
const graphQLMocks = [
  {
    request: {
      query: GRAPHQL_QUERY,
    },
    result: {
      data: {
        hello: { world: 'response from GraphQL server' },
      },
    },
  },
];

// A single component with a scoped style,
// just to show that non-global styles don't
// get duplicated
const StyledDiv = styled.div`
  position: relative;
`;

// A single component with a global style. The bug
// is that this style will be present twice in the
// output from SSR (via `getStyleTags`)
const GlobalStyle = createGlobalStyle`
    html { display: block; }
`;

// Root Component of our test app
const App = () => {
  return (
    <MockedProvider mocks={graphQLMocks}>
      <React.Fragment>
        {/* Add some global styles */}
        <GlobalStyle />
        {/* Add a component that uses useQuery to fetch data */}
        <UseQueryComponent />
      </React.Fragment>
    </MockedProvider>
  );
};

const UseQueryComponent = () => {
  const { data, loading, error } = useQuery(
    gql`
      query {
        hello {
          world
        }
      }
    `
  );
  if (error) throw error;
  return <StyledDiv>{loading ? 'Loading' : data.hello.world}</StyledDiv>;
};

const tests = {
  'styled-components + apollo + ssr default setup': async () => {
    const stylesheet = new ServerStyleSheet();
    const result = await getMarkupFromTree({
      tree: stylesheet.collectStyles(<App />),
      renderFunction: renderToString,
    });

    return `${stylesheet.getStyleTags()}${result}`;
  },

  'styled components + apollo + ssr w/ a gross hack to delete global styles': async () => {
    const stylesheet = new ServerStyleSheet();
    const customRenderFunctionWithStyleReset = (...args) => {
      // Trick Styled-Components (hackily) into thinking there's no previous global styles.
      // The intent is to only capture global styles from the final React tree render
      stylesheet.instance.gs = {};
      return renderToString(...args);
    };
    const result = await getMarkupFromTree({
      tree: stylesheet.collectStyles(<App />),
      // Note: The key here is to wrap the `renderFunction`,
      // so we can hook in before each call to `ReactDOMServer.renderToString`
      renderFunction: customRenderFunctionWithStyleReset,
    });

    return `${stylesheet.getStyleTags()}${result}`;
  },
};

(async () => {
  for (const [testName, func] of Object.entries(tests)) {
    const result = format(`<html>${await func()}</html>`, { parser: 'html' });
    console.log(`\u001b[32m${testName}:\x1b[0m\n${result}`);
  }
})();
