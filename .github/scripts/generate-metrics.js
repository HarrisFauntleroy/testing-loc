import { simpleGit } from 'simple-git';
import fs from 'fs';
import { JSDOM } from 'jsdom';
import * as d3 from 'd3';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCallback);

async function countLinesInCommit(git, commitHash) {
    await git.checkout(commitHash);
    try {
        const { stdout } = await exec('git ls-files');
        const files = stdout.split('\n').filter(Boolean);
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
    } catch (error) {
        console.error('Error listing files:', error);
        return 0;
    }
}

async function generateMetrics() {
    const git = simpleGit();
    const logs = await git.log(['--reverse']);
    const commits = logs.all;
    
    const metrics = [];
    for (const commit of commits) {
        const lines = await countLinesInCommit(git, commit.hash);
        metrics.push({
            date: new Date(commit.date),
            lines: lines
        });
        console.log(`Processed commit ${commit.hash}: ${lines} lines`);
    }
    
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    const document = dom.window.document;
    
    // Updated dimensions and margins
    const margin = { top: 40, right: 50, bottom: 60, left: 70 };
    const width = 900 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;
    
    // Create SVG with white background
    const svg = d3.select(document.body)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .attr('xmlns', 'http://www.w3.org/2000/svg');
        
    // Add white background
    svg.append('rect')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('fill', 'white');
        
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Set up scales with formatted dates
    const x = d3.scaleTime()
        .domain(d3.extent(metrics, d => d.date))
        .range([0, width]);
    
    const y = d3.scaleLinear()
        .domain([0, d3.max(metrics, d => d.lines) * 1.1]) // Add 10% padding
        .nice()
        .range([height, 0]);
    
    // Add grid lines
    g.append('g')
        .attr('class', 'grid')
        .attr('opacity', 0.1)
        .call(d3.axisLeft(y)
            .tickSize(-width)
            .tickFormat('')
        );
    
    // Add line with shadow
    g.append('path')
        .datum(metrics)
        .attr('fill', 'none')
        .attr('stroke', '#2563eb') // Darker blue
        .attr('stroke-width', 2.5)
        .attr('d', d3.line()
            .x(d => x(d.date))
            .y(d => y(d.lines))
        );
    
    // Format axis
    const xAxis = d3.axisBottom(x)
        .ticks(6)
        .tickFormat(d3.timeFormat('%b %Y'));
    
    const yAxis = d3.axisLeft(y)
        .ticks(8)
        .tickFormat(d => d.toLocaleString());
    
    // Add axes with styling
    g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(xAxis)
        .style('font-size', '12px')
        .style('font-family', 'Arial, sans-serif')
        .call(g => g.select('.domain').attr('stroke-width', 2));
    
    g.append('g')
        .call(yAxis)
        .style('font-size', '12px')
        .style('font-family', 'Arial, sans-serif')
        .call(g => g.select('.domain').attr('stroke-width', 2));
    
    // Add axis labels
    g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -margin.left + 20)
        .attr('x', -height / 2)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('font-family', 'Arial, sans-serif')
        .style('font-weight', 'bold')
        .text('Lines of Code');
    
    g.append('text')
        .attr('x', width / 2)
        .attr('y', height + margin.bottom - 10)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('font-family', 'Arial, sans-serif')
        .style('font-weight', 'bold')
        .text('Date');
    
    // Add title
    g.append('text')
        .attr('x', width / 2)
        .attr('y', -margin.top / 2)
        .attr('text-anchor', 'middle')
        .style('font-size', '18px')
        .style('font-family', 'Arial, sans-serif')
        .style('font-weight', 'bold')
        .text('Code Lines Over Time');
    
    const svgString = document.body.innerHTML;
    await fs.promises.writeFile('metrics.svg', svgString);
    
    await git.checkout('main');
}

generateMetrics().catch(console.error);
