// First, add "type": "module" to package.json or rename this file to .mjs
import { simpleGit } from 'simple-git';
import fs from 'fs';
import { JSDOM } from 'jsdom';
import * as d3 from 'd3';

async function countLinesInCommit(git, commitHash) {
    await git.checkout(commitHash);
    
    // Get all files in the repository, excluding .git directory
    const files = await new Promise((resolve, reject) => {
        const { exec } = require('child_process');
        exec('git ls-files', (error, stdout, stderr) => {
            if (error) reject(error);
            resolve(stdout.split('\n').filter(Boolean));
        });
    });
    
    let totalLines = 0;
    
    for (const file of files) {
        try {
            const content = await fs.promises.readFile(file, 'utf8');
            totalLines += content.split('\n').length;
        } catch (error) {
            console.warn(`Skipping file ${file}: ${error.message}`);
        }
    }
    
    return totalLines;
}

async function generateMetrics() {
    const git = simpleGit();
    
    // Get all commits
    const logs = await git.log(['--reverse']);
    const commits = logs.all;
    
    // Count lines for each commit
    const metrics = [];
    for (const commit of commits) {
        const lines = await countLinesInCommit(git, commit.hash);
        metrics.push({
            date: new Date(commit.date),
            lines: lines
        });
    }
    
    // Generate SVG using D3
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    const document = dom.window.document;
    
    const margin = { top: 20, right: 30, bottom: 30, left: 60 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;
    
    const svg = d3.select(document.body)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .attr('xmlns', 'http://www.w3.org/2000/svg')
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Set up scales
    const x = d3.scaleTime()
        .domain(d3.extent(metrics, d => d.date))
        .range([0, width]);
    
    const y = d3.scaleLinear()
        .domain([0, d3.max(metrics, d => d.lines)])
        .nice()
        .range([height, 0]);
    
    // Add line
    svg.append('path')
        .datum(metrics)
        .attr('fill', 'none')
        .attr('stroke', 'steelblue')
        .attr('stroke-width', 1.5)
        .attr('d', d3.line()
            .x(d => x(d.date))
            .y(d => y(d.lines))
        );
    
    // Add axes
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x));
    
    svg.append('g')
        .call(d3.axisLeft(y));
    
    // Add title
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', -margin.top / 2)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .text('Code Lines Over Time');
    
    // Save the SVG
    const svgString = document.body.innerHTML;
    await fs.promises.writeFile('metrics.svg', svgString);
    
    // Checkout back to the original branch
    await git.checkout('main');
}

generateMetrics().catch(console.error);
