/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

/** @type {import('webpack').Configuration} */
module.exports = {
    mode: 'production',
    devtool: 'cheap-source-map',

    entry: {
        'popup/popup': './popup/index.tsx',
        'content/interceptor': './content/interceptor.ts',
        'background/serviceWorker': './background/serviceWorker.ts',
    },

    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
        clean: true,
    },

    resolve: {
        extensions: ['.ts', '.tsx', '.js'],
    },

    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },

    plugins: [
        // Popup HTML
        new HtmlWebpackPlugin({
            template: './popup/popup.html',
            filename: 'popup/popup.html',
            chunks: ['popup/popup'],
        }),

        // Copy static assets
        new CopyPlugin({
            patterns: [
                { from: 'manifest.json', to: 'manifest.json' },
                { from: 'icons', to: 'icons' },
            ],
        }),
    ],
};
