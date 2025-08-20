document.addEventListener('DOMContentLoaded', () => {
  // dynamic project list
  const projects = [
    {
      title: 'AI Log Analysis Tool',
      description: 'Designed a tool that integrates the NSP workflow manager with large language models to parse and analyze network logs.'
    },
    {
      title: 'Intent-Based Service Deployment',
      description: 'Automated network service provisioning using Pydantic schemas and LLaMA models to interpret user intent.'
    }
  ];

  const list = document.getElementById('projects-list');
  projects.forEach(p => {
    const div = document.createElement('div');
    div.className = 'project';
    div.innerHTML = `<h3>${p.title}</h3><p>${p.description}</p>`;
    list.appendChild(div);
  });

  // theme toggle
  const toggle = document.getElementById('theme-toggle');
  const currentTheme = localStorage.getItem('theme');
  if (currentTheme === 'dark') {
    document.body.classList.add('dark');
  }

  toggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
  });

  // resume toggle
  const resumeBtn = document.getElementById('resume-toggle');
  const resumeFrame = document.getElementById('resume-frame');
  resumeBtn.addEventListener('click', () => {
    resumeFrame.classList.toggle('show');
    resumeBtn.textContent = resumeFrame.classList.contains('show') ? 'Hide Resume' : 'Show Resume';
  });

  // set footer year
  document.getElementById('year').textContent = new Date().getFullYear();
});
