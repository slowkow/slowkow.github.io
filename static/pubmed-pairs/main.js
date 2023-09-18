
const timer = ms => new Promise(res => setTimeout(res, ms))

function pairs(first, second) {
	var pairs = []
  for (const x of first) {
    for (const y of second) {
      pairs.push(`${x} ${y}`)
    }
  }
  return pairs
}

var cache_count_papers = {}

async function count_papers(first, second) {
  const term = `${first} ${second}`
  if (term in cache_count_papers) {
    resp = cache_count_papers[term]
  } else {
    await timer(1000)
    // const first = 'tocilizumab'
    // const second = 'HLA-DQA1'
    var resp = await (async function() {
      const queryParams = {
        email: 'kslowikowski@gmail.com',
        usehistory: 'n', db: 'pubmed', term: term, retmode: 'json'
      }
      const queryString = new URLSearchParams(queryParams).toString()
      console.log(`eutils/esearch.fcgi?${queryString}`)
      return await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${queryString}`)
        .then((response) => {
          return response.json()
        })
    })()
    cache_count_papers[term] = resp
  }
  return +resp.esearchresult.count
}

var cache_get_papers = {}

async function get_papers(first, second) {
  const term = `${first} ${second}`
  if (term in cache_get_papers) {
    text = cache_get_papers[term]
  } else {
    var text = await (async function() {
      const queryParams = {
        email: 'kslowikowski@gmail.com',
        usehistory: 'y', db: 'pubmed', term: term, retmode: 'json'
      }
      const queryString = new URLSearchParams(queryParams).toString()
      return await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${queryString}`)
        .then((response) => {
          return response.json()
        })
        .then(async (d) => {
          const pubmed_ids = d.esearchresult.idlist
          const queryString = new URLSearchParams({
            WebEnv: d.esearchresult.webenv,
            db: 'pubmed',
            rettype: 'abstract',
            retmode: 'text',
            id: Array.prototype.join.call(pubmed_ids)
          }).toString()
          return await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?${queryString}`)
            .then((response) => {
              return response.text()
          })
        })
    })()
  }
  return text.split(/\n\s*\n\s*\n/).map((p) => {
    const items = p.split(/\n\s*\n/)
    const doi = items.find(value => /PMID/.test(value))
    const pmid = doi.match(/PMID: (\d+)/)[1]
    return {
      year: items[0].match(/\d{4}/)[0] + '-01-01',
      journal: items[0],
      title: items[1],
      authors: items[2],
      institutions: items[3],
      abstract: items[4],
      pmid: pmid
    }
  })
}


var g_build_table_first = true

async function build_table(data) {
	var head = `<tr class="striped--near-white">
    <th class="pv2 ph3">Pair</th>
    <th class="pv2 ph3">Query</th>
    <th class="pv2 ph3">Results</th>
    <th class="pv2 ph3">View results on PubMed</th>
  </tr>`
	var rows = [head]
  var i = 0
	for (const d of data) {
    i++
		var count = `<span class="hits" id="${d.pair}">${d.count}</span>`
    if (d.count == 0) {
      count = `<span id="${d.pair}">${d.count}</span>`
    }
    var link = `<a target="_blank" rel="noopener noreferrer" href="https://pubmed.ncbi.nlm.nih.gov/?term=${d.pair}">link</a>`
		rows.push(`<tr class="striped--near-white">
      <td class="pv2 ph3">${i}</td>
      <td class="pv2 ph3">${d.pair}</td>
      <td class="pv2 ph3">${count}</td>
      <td class="pv2 ph3">${link}</td>
    </tr>`)
	}
	var table = `<table class="collapse ba br2 b--black-10 pv2 ph3 mt4">
    <tbody>${rows.join('')}</tbody>
  </table>`
	document.getElementById("table").innerHTML = table
	for (const d of data) {
		if (g_build_table_first) {
      g_build_table_first = false
			const papers = await get_papers(d.first, d.second)
			build_papers(papers, d.pair)
		}
		var el = document.getElementById(d.pair)
		el.onclick = async function() {
			const papers = await get_papers(d.first, d.second)
			build_papers(papers, d.pair)
		}
	}
}

function build_papers(papers, title) {
	const papers_title = document.getElementById("papers-title")
	papers_title.innerText = title
	const papers_div = document.getElementById("papers")
  var rows = []
	for (const p of papers) {
    var html = `<article class="pv1">
        <div class="flex flex-row">
          <div class="w-100">
            <p class="f5 fw4 lh-title mv0"><a target="_blank" rel="noopener noreferrer" href="https://pubmed.ncbi.nlm.nih.gov/${p.pmid}">${p.title}</a></p>
            <p class="f7 lh-copy mv0">${p.authors}</p>
            <p class="f7 lh-copy mv0">${p.journal.substr(3)}</p>
            <p class="f7 lh-copy mv0">PMID: <span class="pmid">${p.pmid}</span></p>
            <p class="f7 lh-copy">${p.abstract.substr(0, 300)}<span class="dots"> (show more)</span><span class="more">${p.abstract.substr(300)}</span></p>
          </div>
        </div>
      </article>`
    rows.push(html)
  }
	papers_div.innerHTML = rows.join('\n')
  const dots = document.getElementsByClassName("dots")
  for (const dot of dots) {
    dot.onclick = function() {
      dot.nextElementSibling.style.display = 'inline'
      dot.style.display = 'none'
    }
  }
}

async function click_search() {
  var retval = []
  // const first = document.getElementById("first").value.split(/[ ,;]+/)
  // const second = document.getElementById("second").value.split(/[ ,;]+/)
  const first = document.getElementById("first").value.split(/,/)
  const second = document.getElementById("second").value.split(/,/)
  const ps = pairs(first, second)
  const info =  document.getElementById("info")
  info.innerText = `${ps.length} pairs: ${ps.join(', ')}`
  for (const x of first) {
    for (const y of second) {
      const n = await count_papers(x, y)
      retval.push({
        'pair': `${x} ${y}`, 'first': x, 'second': y, 'count': n
      })
      build_table(retval)
    }
  }
  return retval
}

const search = document.getElementById("search-button")
search.onclick = async function() {
	const data = await click_search()
	build_table(data)
}

