// The following script is extracted from the original MVP HTML file.
// It contains all of the logic required to manage quotes, line
// items, calculation of totals and user interaction. The script
// operates on global DOM elements defined in quotes.html. By
// placing this code in an external file we can include it in a
// Next.js project without cluttering the markup.

// Format numbers as Australian currency with thousands separators
function formatMoney(n){
  const amount = typeof n === 'number' && !isNaN(n) ? n : 0;
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
}
function calcMargin(cost,sell){if(sell<=0)return 0;return (sell-cost)/sell}
function calcMarkup(cost,sell){if(cost<=0)return 0;return (sell-cost)/cost}
const FINAL_STATUSES=['accepted','declined','lost'];
// Quotes will be loaded from the API on page load.  Start with an
// empty list and no selected quote.
let quotes = [];
let currentQuoteId = null;
let selectedLineId=null;
let customerView=false;
const ctxMenu=document.getElementById("contextMenu");
const ctxAddChild=document.getElementById("ctxAddChild");
const ctxDuplicate=document.getElementById("ctxDuplicate");
const ctxDelete=document.getElementById("ctxDelete");
let ctxTargetId=null, ctxTargetParentId=null;
const quoteMenu=document.getElementById("quoteMenu");
const statusMenu=document.getElementById("statusMenu");
let qmTargetQuoteId=null;
function getCurrentQuote(){return quotes.find(q=>q.id===currentQuoteId)}
function isLocked(q){if(!q) q=getCurrentQuote();const s=(q.status||"").toLowerCase();return FINAL_STATUSES.includes(s)}
function switchTab(tab){document.getElementById("tabsBar").style.display="flex";const linesTab=document.getElementById("tabLines");const detailsTab=document.getElementById("tabDetails");const linesPanel=document.getElementById("linesPanel");const detailsPanel=document.getElementById("detailsPanel");if(tab==="lines"){linesTab.classList.add("active");detailsTab.classList.remove("active");linesPanel.style.display="block";detailsPanel.style.display="none";}else{linesTab.classList.remove("active");detailsTab.classList.add("active");linesPanel.style.display="none";detailsPanel.style.display="block";loadDetailFields();}}
function renderQuoteList(){const list=document.getElementById("quoteList");const filter=document.getElementById("quoteFilter").value;list.innerHTML="";let pipelineTotal=0;quotes.forEach(q=>{const st=(q.status||"").toLowerCase();const inProgress=!(FINAL_STATUSES.includes(st)) && !q.archived;if(filter==="inprogress" && !inProgress) return;if(filter==="accepted" && st!=="accepted") return;if(filter==="lost" && !(st==="declined" || st==="lost")) return;if(filter==="archived" && !q.archived) return;if(filter!=="all" && q.archived && filter!=="archived") return;const div=document.createElement("div");div.className="quote-list-item"+(q.id===currentQuoteId?" active":"");div.onclick=()=>selectQuote(q.id);div.oncontextmenu=(e)=>openQuoteMenu(e,q.id);const totals=calculateQuoteTotals(q);pipelineTotal += totals.sellTotal * (q.probability || 0);div.innerHTML=`<strong style="font-size:.75rem;">${q.name}</strong><small>${q.client||""}</small><small>Status: ${q.status}${q.archived?" • Archived":""}</small><small>Value: ${formatMoney(totals.sellTotal)}</small>`;list.appendChild(div);});document.getElementById("pipelineTotal").textContent=formatMoney(pipelineTotal);}
function selectQuote(id){currentQuoteId=id;selectedLineId=null;renderQuoteList();renderQuote();if(document.getElementById("detailsPanel").style.display!="none") loadDetailFields();document.getElementById("tabsBar").style.display="flex";}
function renderQuote(){const q=getCurrentQuote();if(!q){ // No quote selected; clear displays
  document.getElementById("quoteTitle").textContent="No Quote Selected";
  document.getElementById("quoteClient").textContent="";
  document.getElementById("quoteProb").textContent="";
  const stEl=document.getElementById("quoteStatus");
  stEl.textContent="";
  stEl.className="status-badge";
  document.getElementById("acumaticaBtn").classList.add("ac-disabled");
  document.getElementById("lineBody").innerHTML="";
  document.getElementById("actualCost").textContent=formatMoney(0);
  document.getElementById("quoteTotalEx").textContent=formatMoney(0);
  document.getElementById("profitVal").textContent=formatMoney(0);
  document.getElementById("profitMargin").textContent="0%";
  document.getElementById("gst").textContent=formatMoney(0);
  document.getElementById("grandTotal").textContent=formatMoney(0);
  return;
}
document.getElementById("quoteTitle").textContent=`Quote #${q.id} – ${q.name}`;
document.getElementById("quoteClient").textContent=`Client: ${q.client||""}`;
document.getElementById("quoteProb").textContent=((q.probability||0)*100).toFixed(0)+"%";
const stEl=document.getElementById("quoteStatus");
const stLow=(q.status||"").toLowerCase();stEl.textContent=q.status||"Draft";stEl.className="status-badge";if(stLow==="accepted") stEl.classList.add("accepted");if(stLow==="declined" || stLow==="lost") stEl.classList.add("declined");document.getElementById("acumaticaBtn").classList.toggle("ac-disabled",stLow!=="accepted");const tbody=document.getElementById("lineBody");tbody.innerHTML="";let actualCost=0;let quoteTotalEx=0;const locked=isLocked(q);q.lines.forEach(parent=>{let parentCost=0,parentSell=0;if(parent.children && parent.children.length){parent.children.forEach(ch=>{parentCost+=ch.cost*ch.qty; parentSell+=ch.sell*ch.qty;});parent.cost=parentCost;parent.sell=parentSell;parent.margin=calcMargin(parentCost,parentSell);parent.markup=calcMarkup(parentCost,parentSell);}else{parentCost=parent.cost*parent.qty;parentSell=parent.sell*parent.qty;}actualCost+=parentCost;quoteTotalEx+=parentSell;const tr=document.createElement("tr");tr.className="line-item";tr.dataset.id=parent.id;tr.onclick=()=>setSelectedLine(parent.id);tr.oncontextmenu=(e)=>openLineMenu(e,parent.id,null);const sellValue = (parent.children&&parent.children.length) ? parent.sell.toFixed(2) : parent.sell;const costValue = (parent.children&&parent.children.length) ? parent.cost.toFixed(2) : parent.cost;const markupValue = (parent.markup*100).toFixed(1);const marginValue = (parent.margin*100).toFixed(1);tr.innerHTML=`<td><button class="expand-btn" onclick="toggleExpand(event,'${parent.id}')" ${locked?"disabled":""}>${parent.expanded?"–":"+"}</button></td><td><div style="display:flex;align-items:center;gap:.25rem;"><button class="folder-btn" onclick="addChildLineFromIcon(event,'${parent.id}')" ${locked?"disabled":""}><span class="folder-icon">📁</span><span class="plus-icon">+</span></button><input type="text" value="${parent.description}" onchange="updateParentDesc('${parent.id}',this.value)" ${locked?"disabled":""}/></div>${parent.children && parent.children.length ? `<div style="color:#6b7280;font-size:.6rem;">${parent.children.length} calc line(s)</div>` : ""}</td><td class="calc-col"><input type="number" value="${parent.qty}" onchange="updateParentField('${parent.id}','qty',this.value)" ${locked?"disabled":""}/></td><td class="calc-col"><input type="number" value="${costValue}" onchange="updateParentField('${parent.id}','cost',this.value)" ${(parent.children&&parent.children.length)||locked?'disabled':''}/></td><td class="calc-col"><input type="number" value="${markupValue}" onchange="updateParentField('${parent.id}','markup',this.value)" ${(parent.children&&parent.children.length)||locked?'disabled':''}/></td><td class="calc-col"><input type="number" value="${sellValue}" onchange="updateParentField('${parent.id}','sell',this.value)" ${(parent.children&&parent.children.length)||locked?'disabled':''}/></td><td class="calc-col"><input type="number" value="${marginValue}" onchange="updateParentField('${parent.id}','margin',this.value)" ${(parent.children&&parent.children.length)||locked?'disabled':''}/></td><td>${formatMoney(parentSell)}</td>`;tbody.appendChild(tr);if(parent.children && parent.children.length){parent.children.forEach(ch=>{const ctr=document.createElement("tr");ctr.className="child-row"+(customerView?" hidden-for-pdf":"");ctr.dataset.id=ch.id;ctr.dataset.parentId=parent.id;ctr.style.display=parent.expanded && !customerView ? "table-row" : (customerView?"none":"none");ctr.onclick=()=>setSelectedLine(ch.id);ctr.oncontextmenu=(e)=>openLineMenu(e,ch.id,parent.id);const lineTotal=ch.sell*ch.qty;ctr.innerHTML=`<td></td><td class="indent"><span class="badge">Calc</span><input type="text" value="${ch.description}" onchange="updateChildField('${parent.id}','${ch.id}','description',this.value)" ${locked?"disabled":""}/></td><td class="calc-col"><input type="number" value="${ch.qty}" onchange="updateChildField('${parent.id}','${ch.id}','qty',this.value)" ${locked?"disabled":""}/></td><td class="calc-col"><input type="number" value="${ch.cost.toFixed(2)}" onchange="updateChildField('${parent.id}','${ch.id}','cost',this.value)" ${locked?"disabled":""}/></td><td class="calc-col"><input type="number" value="${(ch.markup*100).toFixed(1)}" onchange="updateChildField('${parent.id}','${ch.id}','markup',this.value)" ${locked?"disabled":""}/></td><td class="calc-col"><input type="number" value="${ch.sell.toFixed(2)}" onchange="updateChildField('${parent.id}','${ch.id}','sell',this.value)" ${locked?"disabled":""}/></td><td class="calc-col"><input type="number" value="${(ch.margin*100).toFixed(1)}" onchange="updateChildField('${parent.id}','${ch.id}','margin',this.value)" ${locked?"disabled":""}/></td><td>${formatMoney(lineTotal)}</td>`;tbody.appendChild(ctr);});}});const profit=quoteTotalEx - actualCost;const profitMargin=quoteTotalEx>0 ? (profit/quoteTotalEx) : 0;const gst=quoteTotalEx * 0.1;const grand=quoteTotalEx + gst;document.getElementById("actualCost").textContent=formatMoney(actualCost);document.getElementById("quoteTotalEx").textContent=formatMoney(quoteTotalEx);document.getElementById("profitVal").textContent=formatMoney(profit);document.getElementById("profitMargin").textContent=(profitMargin*100).toFixed(1)+"%";document.getElementById("gst").textContent=formatMoney(gst);document.getElementById("grandTotal").textContent=formatMoney(grand);document.getElementById("linesBody").classList.toggle("locked",locked);document.getElementById("detailsBody").classList.toggle("locked",locked);} 
function calculateQuoteTotals(q){let cost=0,sell=0;q.lines.forEach(parent=>{if(parent.children && parent.children.length){parent.children.forEach(c=>{cost+=c.cost*c.qty; sell+=c.sell*c.qty;});} else {cost+=parent.cost*parent.qty;sell+=parent.sell*parent.qty;}});return {costTotal:cost,sellTotal:sell};}
function loadDetailFields(){const q=getCurrentQuote();document.getElementById("detailDate").value=q.date||"";document.getElementById("detailOwner").value=q.owner||"";document.getElementById("detailCustomer").value=q.client||"";document.getElementById("detailSubject").value=q.name||"";document.getElementById("detailSummary").value=q.summary||"";document.getElementById("detailAddress").value=q.address||"";document.getElementById("detailStage").value=q.stage||"";document.getElementById("detailStatus").value=q.status||"Draft";document.getElementById("detailProbability").value=q.probability ? (q.probability * 100) : "";document.getElementById("rte").innerHTML = q.descriptionHtml || "";}
function updateDetailField(field,value){const q=getCurrentQuote();if(field==="probability"){q.probability = value==="" ? 0 : (parseFloat(value)/100);} else if(field==="client"){q.client = value;} else if(field==="name"){q.name = value;} else if(field==="status"){const old=(q.status||"").toLowerCase();const target=(value||"").toLowerCase();if(FINAL_STATUSES.includes(old) && !FINAL_STATUSES.includes(target)){const ok=confirm(`This quote is currently ${q.status}. Change status to ${value} and unlock editing?`);if(!ok){ loadDetailFields(); return; }}q.status = value;} else {q[field] = value;}renderQuoteList();renderQuote();}
function rteCmd(cmd){ document.execCommand(cmd,false,null); }
function saveRte(){const q=getCurrentQuote();q.descriptionHtml = document.getElementById("rte").innerHTML;q.descriptionInitialized = true;}
function insertTemplateForCurrentQuote(){const q=getCurrentQuote();const html = defaultRteTemplate(q);q.descriptionHtml = html;q.descriptionInitialized = true;document.getElementById("rte").innerHTML = html;}
function defaultRteTemplate(q){const subj = q.name || "{{quote subject}}";const summ = q.summary || "{{quote summary}}";const addr = q.address || "{{quote address}}";return `<p>This quote outlines the scope of works, inclusions, exclusions and related cost for the following.</p>\n<p>|</p>\n<p><strong>Project:</strong> ${subj}<br/><strong>Scope:</strong> ${summ}<br/><strong>Product:</strong> </p>\n<p><strong>Site Address:</strong> ${addr}</p>\n<p><strong>Scope of Works</strong></p>\n<ul><li>Take up of existing</li><li>Minor floor patching / scraping if required</li><li>Supply and install specified carpet tile</li><li>Clean site and remove waste</li></ul>\n<p><strong>Exclusions</strong></p>\n<ul><li>Anything not itemised in quote</li></ul>\n<p>If you have any questions regarding this quote, please do not hesitate to get in touch</p>`;}
function setSelectedLine(id){selectedLineId=id}
function toggleExpand(e,pid){e.stopPropagation();const q=getCurrentQuote();const p=q.lines.find(l=>l.id===pid);p.expanded=!p.expanded;renderQuote();}
function updateParentDesc(pid,val){const q=getCurrentQuote();q.lines.find(l=>l.id===pid).description=val;}
function updateParentField(pid,field,val){const q=getCurrentQuote();const p=q.lines.find(l=>l.id===pid);const num=parseFloat(val);if(field==="qty"){p.qty=isNaN(num)?0:num;} else if(field==="cost"){p.cost=isNaN(num)?0:num;p.margin=calcMargin(p.cost,p.sell);p.markup=calcMarkup(p.cost,p.sell);} else if(field==="sell"){p.sell=isNaN(num)?0:num;p.margin=calcMargin(p.cost,p.sell);p.markup=calcMarkup(p.cost,p.sell);} else if(field==="margin"){const m=isNaN(num)?0:num/100;p.margin=m;p.sell = (1-m)!==0 ? p.cost/(1-m) : p.cost;p.markup=calcMarkup(p.cost,p.sell);} else if(field==="markup"){const mk=isNaN(num)?0:num/100;p.markup=mk;p.sell=p.cost*(1+mk);p.margin=calcMargin(p.cost,p.sell);}renderQuote();}
function updateChildField(pid,cid,field,val){const q=getCurrentQuote();const p=q.lines.find(l=>l.id===pid);const c=p.children.find(x=>x.id===cid);const num=parseFloat(val);if(field==="description"){c.description=val;return;}if(field==="qty"){c.qty=isNaN(num)?0:num;} else if(field==="cost"){c.cost=isNaN(num)?0:num;c.margin=calcMargin(c.cost,c.sell);c.markup=calcMarkup(c.cost,c.sell);} else if(field==="sell"){c.sell=isNaN(num)?0:num;c.margin=calcMargin(c.cost,c.sell);c.markup=calcMarkup(c.cost,c.sell);} else if(field==="margin"){const m=isNaN(num)?0:num/100;c.margin=m;c.sell=(1-m)!==0 ? c.cost/(1-m) : c.cost;c.markup=calcMarkup(c.cost,c.sell);} else if(field==="markup"){const mk=isNaN(num)?0:num/100;c.markup=mk;c.sell=c.cost*(1+mk);c.margin=calcMargin(c.cost,c.sell);}renderQuote();}
function addParentLine(){const q=getCurrentQuote();const newId="L"+(q.lines.length+1);q.lines.push({id:newId,description:"New line item",qty:1,cost:0,markup:0,sell:0,margin:0,isParent:true,children:[],expanded:true});renderQuote();}
function addChildLineFromIcon(e,pid){e.stopPropagation();addChildLineInternal(pid);}
function addChildLineInternal(pid){const q=getCurrentQuote();const p=q.lines.find(l=>l.id===pid);if(!p.children) p.children=[];const newId=pid+"-"+(p.children.length+1);let child={id:newId,description:"Child calc line",qty:1,cost:0,markup:0,sell:0,margin:0,isParent:false};if(p.children.length===0){child.description=p.description||"Child calc line";child.qty=p.qty||1;child.cost=p.cost||0;child.sell=p.sell||0;child.margin=p.sell?calcMargin(child.cost,child.sell):0;child.markup=p.sell?calcMarkup(child.cost,child.sell):0;p.cost=0;p.sell=0;p.margin=0;p.markup=0;}p.children.push(child);p.expanded=true;renderQuote();}
function openLineMenu(e,id,parentId){e.preventDefault();const q=getCurrentQuote();if(isLocked(q)) return;ctxTargetId=id;ctxTargetParentId=parentId;document.getElementById("ctxAddChild").style.display = parentId ? "none" : "block";ctxMenu.style.left=e.clientX+"px";ctxMenu.style.top=e.clientY+"px";ctxMenu.style.display="block";}
window.addEventListener("click",()=>{ctxMenu.style.display="none";quoteMenu.style.display="none";statusMenu.style.display="none";});
ctxAddChild.onclick=()=>{if(ctxTargetId){addChildLineInternal(ctxTargetId)}ctxMenu.style.display="none";};
ctxDuplicate.onclick=()=>{const q=getCurrentQuote();if(ctxTargetParentId){const p=q.lines.find(l=>l.id===ctxTargetParentId);const orig=p.children.find(c=>c.id===ctxTargetId);const newId=ctxTargetParentId+"-"+(p.children.length+1);p.children.push({...orig,id:newId});} else {const orig=q.lines.find(l=>l.id===ctxTargetId);const newId="L"+(q.lines.length+1);const copy=JSON.parse(JSON.stringify(orig));copy.id=newId;q.lines.push(copy);}ctxMenu.style.display="none";renderQuote();};
ctxDelete.onclick=()=>{if(!confirm("Delete this line?")){ctxMenu.style.display="none";return;}const q=getCurrentQuote();if(ctxTargetParentId){const p=q.lines.find(l=>l.id===ctxTargetParentId);p.children=p.children.filter(c=>c.id!==ctxTargetId);} else {q.lines=q.lines.filter(l=>l.id!==ctxTargetId);}ctxMenu.style.display="none";renderQuote();};
function openQuoteMenu(e,quoteId){e.preventDefault();qmTargetQuoteId=quoteId;quoteMenu.style.left=e.clientX+"px";quoteMenu.style.top=e.clientY+"px";quoteMenu.style.display="block";}
document.getElementById("qmDuplicate").onclick=()=>{duplicateQuote(qmTargetQuoteId);quoteMenu.style.display="none";};
document.getElementById("qmArchive").onclick=()=>{archiveQuote(qmTargetQuoteId);quoteMenu.style.display="none";};
document.getElementById("qmPdf").onclick=()=>{
  if(!qmTargetQuoteId) return;
  window.open(`/api/quotes/${qmTargetQuoteId}/document?format=pdf`, '_blank');
  quoteMenu.style.display = "none";
};
document.getElementById("qmXlsx").onclick=()=>{
  if(!qmTargetQuoteId) return;
  window.open(`/api/quotes/${qmTargetQuoteId}/takeoff`, '_blank');
  quoteMenu.style.display = "none";
};
document.getElementById("qmChangeStatus").onclick=()=>{const rect=quoteMenu.getBoundingClientRect();statusMenu.style.left=(rect.right+6)+"px";statusMenu.style.top=rect.top+"px";statusMenu.style.display="block";};
function quickStatus(newStatus){changeQuoteStatus(qmTargetQuoteId,newStatus);statusMenu.style.display="none";quoteMenu.style.display="none";}
function duplicateQuote(id){const orig=quotes.find(q=>q.id===id);if(!orig) return;const copy=JSON.parse(JSON.stringify(orig));copy.id="Q-"+(1000+quotes.length+1);copy.name=orig.name+" (Copy)";copy.status="Draft";copy.archived=false;quotes.unshift(copy);renderQuoteList();}
function changeQuoteStatus(id,newStatus){const q=quotes.find(x=>x.id===id);if(!q) return;const old=(q.status||"").toLowerCase();const target=(newStatus||"").toLowerCase();if(FINAL_STATUSES.includes(old) && !FINAL_STATUSES.includes(target)){const ok=confirm(`"${q.id}" is ${q.status}. Change status to ${newStatus} and unlock editing?`);if(!ok) return;}q.status=newStatus;if(q.id===currentQuoteId){renderQuote();}renderQuoteList();}
function archiveQuote(id){const q=quotes.find(x=>x.id===id);if(!q) return;q.archived=true;renderQuoteList();if(q.id===currentQuoteId) renderQuote();}
function toggleCustomerView(){customerView=!customerView;document.getElementById("showCalcCols").checked=!customerView;toggleCalcCols(!customerView);renderQuote();}
function toggleCalcCols(show){document.querySelectorAll(".calc-col").forEach(c=>c.style.display=show?"table-cell":"none");}
function exportToAcumatica(){
  const q = getCurrentQuote();
  if(!q){alert('No quote selected');return;}
  if((q.status||'').toLowerCase() !== 'accepted'){
    alert('Only accepted quotes can be exported.');
    return;
  }
  window.open(`/api/quotes/${q.id}/acumatica`, '_blank');
}
async function saveQuote(){
  const q = getCurrentQuote();
  if(!q){alert('No quote selected');return;}
  try{
    const res = await fetch(`/api/quotes/${q.id}`,{
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(q)
    });
    if(res.ok){
      alert('Quote saved');
    }else{
      const err = await res.json();
      alert(err.error || 'Failed to save quote');
    }
  }catch(err){
    console.error(err);
    alert('Failed to save quote');
  }
}
async function newQuote(){
  const name = prompt('Enter quote name','New quote');
  if(!name) return;
  try{
    const res = await fetch('/api/quotes',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ name })
    });
    if(res.ok){
      const created = await res.json();
      quotes.unshift(created);
      currentQuoteId = created.id;
      renderQuoteList();
      renderQuote();
      switchTab('details');
      document.getElementById("tabsBar").style.display = "flex";
    }else{
      const err = await res.json();
      alert(err.error || 'Failed to create quote');
    }
  }catch(err){
    console.error(err);
    alert('Failed to create quote');
  }
}
// Fetch initial quotes from the API and render them once the page
// has loaded.  This replaces the static seed data used in the
// original MVP.  If no quotes exist the list will remain empty
// until a new quote is created.
async function loadQuotes(){
  try{
    const res = await fetch('/api/quotes');
    if(res.ok){
      quotes = await res.json();
      if(quotes.length){
        currentQuoteId = quotes[0].id;
      }
      renderQuoteList();
      renderQuote();
    } else {
      console.error('Failed to load quotes');
    }
  }catch(err){
    console.error(err);
  }
}
window.addEventListener('load',()=>{
  loadQuotes();
});

// Toggle the sidebar on small screens by adding/removing the
// hide-sidebar class on the app shell container.  A matching
// media query in the HTML controls the visibility of the toggle
// button.
function toggleSidebar(){
  const shell=document.querySelector('.app-shell');
  if(shell){
    shell.classList.toggle('hide-sidebar');
  }
}