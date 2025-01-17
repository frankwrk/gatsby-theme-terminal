const {
  createFilePath,
  createRemoteFileNode,
} = require('gatsby-source-filesystem')

const path = require('path')

// String used to differenciate between .mdx sources from pages and .mdx souced from "source"
const OWNER_NAME = 'source'

// https://www.gatsbyjs.com/docs/how-to/images-and-media/preprocessing-external-images/
exports.createSchemaCustomization = ({ actions }) => {
  const { createTypes } = actions

  createTypes(`
    type Mdx implements Node {
      frontmatter: Frontmatter
      featuredImageUrlSharp: File @link(from: "featuredImageUrlSharp___NODE")
    }
  `)

  // Logs out all typeDefs
  // actions.printTypeDefinitions({ path: './typeDefs.txt' })
}

exports.onCreateNode = async (
  {
    node,
    actions: { createNodeField, createNode },
    getNode,
    store,
    cache,
    createNodeId,
  },
  themeOptions
) => {
  const { source } = themeOptions

  if (node.internal.type === 'Mdx' && !node.internal.fieldOwners) {
    let path = source
    const value = createFilePath({ node, getNode })

    if (Array.isArray(source)) {
      path = node.fileAbsolutePath
        .split('/')
        .filter(str => source.includes(str))
        .toString()
    }
    createNodeField({
      node,
      name: `slug`,
      value: path ? `/${path}${value}` : value,
    })
    // a owner and parent node fields to the .mdx sourced from "source"
    createNodeField({
      node,
      name: `owner`,
      value: OWNER_NAME,
    })
    // used as a back link to URL, path is the "source" name
    createNodeField({
      node,
      name: `parent`,
      value: path,
    })

    // https://www.gatsbyjs.com/docs/how-to/images-and-media/preprocessing-external-images/
    if (
      node.frontmatter.featuredImageUrl &&
      node.frontmatter.featuredImageUrl !== undefined
    ) {
      let fileNode = await createRemoteFileNode({
        url: node.frontmatter.featuredImageUrl,
        parentNodeId: node.id,
        createNode,
        createNodeId,
        cache,
        store,
      })

      if (fileNode) {
        node.featuredImageUrlSharp___NODE = fileNode.id
      }
    }
  }
}

exports.createPages = async ({ graphql, actions, reporter }, themeOptions) => {
  const { source } = themeOptions
  const { createPage } = actions

  if (!source) return

  const result = await graphql(`
    query {
      allMdx(
        filter: {
          frontmatter: {
            title: { ne: "dummy" }
            navigationLabel: { ne: "dummy" }
            status: { ne: "draft" }
          }
          fields: { owner: { eq: "source" } }
        }
        sort: { order: DESC, fields: [frontmatter___date] }
      ) {
        edges {
          previous {
            frontmatter {
              title
              status
            }
            fields {
              slug
            }
          }
          next {
            frontmatter {
              title
              status
            }
            fields {
              slug
            }
          }
          node {
            id
            frontmatter {
              title
              navigationLabel
            }
            fields {
              slug
              owner
              parent
            }
          }
        }
      }
    }
  `)

  if (result.errors) {
    reporter.panicOnBuild('🚨  ERROR: Loading "createPages" query')
  }

  const data = result.data.allMdx.edges

  data.forEach(({ node, previous, next }, index) => {
    createPage({
      path: node.fields.slug,
      component: path.join(__dirname, `src/layouts/SourceLayout.js`),
      context: {
        id: node.id,
        prev: index === 0 ? null : previous,
        next: index === data.length - 1 ? null : next,
        // used as back link in SourceLayout
        parent: node.fields.parent,
      },
    })
  })
}
