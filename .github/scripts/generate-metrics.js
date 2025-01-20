import { simpleGit } from 'simple-git';
import fs from 'fs';
import { JSDOM } from 'jsdom';
import * as d3 from 'd3';

async function generateMetrics() {
    const git = simpleGit();
    
    // Get log with numstat for detailed statistics
    const logs = await git.log(['--reverse', '--numstat']);
    
    // Process commit stats
    let totalLines = 0;
    const metrics = logs.all.map(commit => {
        // Parse the numstat output to get insertions and deletions
        let insertions = 0;
        let deletions = 0;
        
        if (commit.diff) {
            commit.diff.split('\n').forEach(line => {
                if (line.trim()) {
                    const [ins, del] = line.split('\t').map(n => parseInt(n) || 0);
                    insertions += ins;
                    deletions += del;
                }
            });
        }

        totalLines += (insertions - deletions);
        
        return {
            date: new Date(commit.date),
            total: totalLines,
            insertions,
            deletions
        };
    });

    console.log('First few metrics entries:', metrics.slice(0, 3));

    // Set up SVG
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    const document = dom.window.document;
    
    const margin = { top: 40, right: 50, bottom: 60, left: 70 };
    const width = 900 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;
    
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
    
    // Set up scales
    const x = d3.scaleTime()
        .domain(d3.extent(metrics, d => d.date))
        .range([0, width]);
    
    const y = d3.scaleLinear()
        .domain([0, d3.max(metrics, d => d.total) * 1.1])
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
    
    // Add the line with a fun style (similar to XKCD)
    const lineGenerator = d3.line()
        .x(d => x(d.date))
        .y(d => y(d.total))
        .curve(d3.curveBasis); // Makes the line slightly wobbly
    
    g.append('path')
        .datum(metrics)
        .attr('fill', 'none')
        .attr('stroke', '#2563eb')
        .attr('stroke-width', 3)
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', 'round')
        .attr('d', lineGenerator);
    
    // Add axes with styling
    const xAxis = d3.axisBottom(x)
        .ticks(6)
        .tickFormat(d3.timeFormat('%b %Y'));
    
    const yAxis = d3.axisLeft(y)
        .ticks(8)
        .tickFormat(d => d.toLocaleString());
    
    g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(xAxis)
        .style('font-size', '12px')
        .style('font-family', 'Comic Sans MS, cursive')
        .call(g => g.select('.domain').attr('stroke-width', 2));
    
    g.append('g')
        .call(yAxis)
        .style('font-size', '12px')
        .style('font-family', 'Comic Sans MS, cursive')
        .call(g => g.select('.domain').attr('stroke-width', 2));
    
    // Add axis labels with hand-drawn style
    g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -margin.left + 20)
        .attr('x', -height / 2)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('font-family', 'Comic Sans MS, cursive')
        .text('Lines of Code');
    
    g.append('text')
        .attr('x', width / 2)
        .attr('y', height + margin.bottom - 10)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('font-family', 'Comic Sans MS, cursive')
        .text('Time →');
    
    // Add title with hand-drawn style
    g.append('text')
        .attr('x', width / 2)
        .attr('y', -margin.top / 2)
        .attr('text-anchor', 'middle')
        .style('font-size', '18px')
        .style('font-family', 'Comic Sans MS, cursive')
        .text('Lines of Code Over Time');
    
    // Save the SVG
    const svgString = document.body.innerHTML;
    await fs.promises.writeFile('metrics.svg', svgString);
}

generateMetrics().catch(console.error);
