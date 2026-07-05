const KEYS = {
  transactions: "baya.transactions", fixedExpenses: "baya.fixedExpenses",
  settings: "baya.settings", categories: "baya.categories", paymentMethods: "baya.paymentMethods"
};
const defaults = {
  transactions: [], fixedExpenses: [],
  settings: { person1Name: "Você", person2Name: "Parceira", expectedMonthlyIncome: 0, monthlySavingGoal: 0, hideValuesOnHome: true, privacyMode: false, categoryBudgets: {} },
  categories: ["Mercado","Transporte","Saúde","Alimentação","Contas","Pets","Lazer","Educação","Receita","Outros"],
  paymentMethods: ["Pix","Crédito","Débito","Dinheiro","Boleto","Transferência"]
};
const state = {
  data: loadAll(), page: "home", entryType: "expense", amountDigits: "", filter: { month: currentMonth(), type: "all", category: "all", search: "" },
  receiptFile: null
};
const money = new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});
const dateBR = new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"short"});
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];

function clone(v){return JSON.parse(JSON.stringify(v))}
function load(key,fallback){try{return JSON.parse(localStorage.getItem(key)) ?? clone(fallback)}catch{return clone(fallback)}}
function loadAll(){return Object.fromEntries(Object.entries(defaults).map(([k,v])=>[k,load(KEYS[k],v)]))}
function persist(name){localStorage.setItem(KEYS[name],JSON.stringify(state.data[name]))}
function persistAll(){Object.keys(KEYS).forEach(persist)}
function id(){return `${Date.now()}-${Math.random().toString(16).slice(2)}`}
function localDateParts(){const d=new Date();return {year:d.getFullYear(),month:String(d.getMonth()+1).padStart(2,"0"),day:String(d.getDate()).padStart(2,"0")}}
function currentMonth(){const d=localDateParts();return `${d.year}-${d.month}`}
function today(){const d=localDateParts();return `${d.year}-${d.month}-${d.day}`}
function esc(v=""){const d=document.createElement("div");d.textContent=v;return d.innerHTML}
function parseMoney(v){return Number(String(v).replace(/[^\d,]/g,"").replace(",","."))||0}
function moneyInput(n){return n?Number(n).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}):""}
function empty(icon,title,text){return `<div class="empty"><i>${icon}</i><h3>${title}</h3><p>${text}</p></div>`}
function toast(text){$("#toast p").textContent=text;$("#toast").classList.add("show");setTimeout(()=>$("#toast").classList.remove("show"),2300)}
function monthTransactions(month=currentMonth()){return state.data.transactions.filter(t=>t.date.slice(0,7)===month)}

function totals(items=monthTransactions()){
  return items.reduce((a,t)=>{t.type==="income"?a.income+=t.amount:a.expense+=t.amount;return a},{income:0,expense:0});
}
function analytics(items=monthTransactions()){
  const t=totals(items), balance=t.income-t.expense, savingRate=t.income?balance/t.income*100:0;
  const days=new Date().getDate(), lastDay=new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate();
  const daily=t.expense/days, forecast=daily*lastDay;
  const by=(field)=>items.filter(x=>x.type==="expense").reduce((a,x)=>{const key=x[field]||"Não informado";a[key]=(a[key]||0)+x.amount;return a},{});
  return {...t,balance,savingRate,daily,forecast,byCategory:by("category"),byPerson:by("paidBy"),byClassification:by("classification")};
}

function suggestCategory(name){
  const n=name.toLowerCase();
  const rules=[[/mercado|supermercado|feira/,"Mercado"],[/uber|^99$|gasolina|combustível|combustivel/,"Transporte"],[/farmácia|farmacia|remédio|remedio|consulta/,"Saúde"],[/ifood|restaurante|café|cafe/,"Alimentação"],[/aluguel|condomínio|condominio|luz|água|agua|internet/,"Contas"],[/pet|ração|racao|veterinário|veterinario/,"Pets"],[/salário|salario|freela|freelance|reembolso/,"Receita"]];
  return rules.find(([r])=>r.test(n))?.[1]||"";
}

function navigate(page){
  state.page=page; $$(".view").forEach(v=>v.classList.toggle("active",v.dataset.view===page));
  $$(".nav").forEach(n=>n.classList.toggle("active",n.dataset.go===page));
  if(page==="launch"&&!$("#transaction-id").value) resetTransactionForm();
  render(); window.scrollTo({top:0,behavior:"smooth"});
}

function transactionCard(t,home=false){
  const person=t.paidBy||"Não informado", meta=`${t.category||"Sem categoria"} · ${dateBR.format(new Date(`${t.date}T12:00:00`))}`;
  return `<article class="movement">
    <span class="movement-icon">${t.type==="income"?"↙":"↗"}</span>
    <div><h3>${esc(t.name)}</h3><p>${meta}${home?"":` · ${esc(person)} · ${esc(t.paymentMethod||"Sem forma")}`}</p></div>
    <div class="movement-side"><div class="movement-value sensitive ${t.type==="income"?"income":""}">${t.type==="income"?"+":"−"} ${money.format(t.amount)}</div>
    ${home?"":`<div class="movement-actions"><button data-edit="${t.id}">Editar</button>${t.receiptImageId||t.receiptData?`<button data-receipt="${t.id}">Foto</button>`:""}<button data-delete="${t.id}">Excluir</button></div>`}</div>
  </article>`;
}

function renderHome(){
  const items=monthTransactions(), a=analytics(items), s=state.data.settings;
  const name=s.person1Name&&s.person2Name?`${s.person1Name} e ${s.person2Name}`:"vocês dois";
  const hour=new Date().getHours(), hello=hour<12?"Bom dia":hour<18?"Boa tarde":"Boa noite";
  $("#greeting").textContent=`${hello}, ${name}`;
  if(!items.length){$("#home-status").textContent="Um começo tranquilo.";$("#home-status-copy").textContent="Hoje é um bom dia para registrar os movimentos."}
  else if(a.savingRate>=20){$("#home-status").textContent="Vocês estão no caminho.";$("#home-status-copy").textContent="O ritmo do mês está confortável até aqui."}
  else{$("#home-status").textContent="Consciência já é progresso.";$("#home-status-copy").textContent="Cada registro deixa as próximas escolhas mais leves."}
  const recent=[...items].sort((x,y)=>y.date.localeCompare(x.date)||y.createdAt.localeCompare(x.createdAt)).slice(0,3);
  $("#home-transactions").innerHTML=recent.length?recent.map(t=>transactionCard(t,true)).join(""):empty("+","Tudo começa no primeiro registro","Toque em “Lançar gasto” para começar, sem precisar categorizar.");
  $("#home-transactions").classList.toggle("home-hidden",s.hideValuesOnHome);
}

function renderLaunch(){
  const last=state.data.transactions[0];$("#repeat-last").hidden=!last;
  $("#amount-display").textContent=moneyInput(Number(state.amountDigits||0)/100)||"0,00";
}
function renderSelects(){
  const cats=state.data.categories, pays=state.data.paymentMethods, people=[state.data.settings.person1Name,state.data.settings.person2Name].filter(Boolean);
  $("#transaction-category").innerHTML=`<option value="">Sem categoria</option>`+cats.map(x=>`<option>${esc(x)}</option>`).join("");
  $("#fixed-category").innerHTML=cats.map(x=>`<option>${esc(x)}</option>`).join("");
  $("#category-filter").innerHTML=`<option value="all">Todas categorias</option>`+cats.map(x=>`<option>${esc(x)}</option>`).join("");
  $("#transaction-payment").innerHTML=`<option value="">Não informar</option>`+pays.map(x=>`<option>${esc(x)}</option>`).join("");
  const personOptions=`<option value="">Não informar</option>`+people.map(x=>`<option>${esc(x)}</option>`).join("");
  $("#transaction-paid-by").innerHTML=personOptions;$("#fixed-paid-by").innerHTML=personOptions;
}
function filteredTransactions(){
  const f=state.filter;
  return [...state.data.transactions].filter(t=>
    (!f.month||t.date.startsWith(f.month))&&(f.type==="all"||t.type===f.type)&&(f.category==="all"||t.category===f.category)&&t.name.toLowerCase().includes(f.search.toLowerCase())
  ).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));
}
function renderTransactions(){
  const items=filteredTransactions();
  $("#transactions-list").innerHTML=items.length?items.map(t=>transactionCard(t)).join(""):empty("≡","Nada por aqui","Ajuste os filtros ou faça um novo lançamento.");
  bindDynamicActions();
}
function chart(title,obj){
  const entries=Object.entries(obj).sort((a,b)=>b[1]-a[1]);if(!entries.length)return"";
  const max=entries[0][1]||1;
  return `<article class="chart-card"><h3>${title}</h3>${entries.map(([k,v])=>`<div class="chart-row"><span>${esc(k)}</span><span class="mini-bar"><i style="width:${v/max*100}%"></i></span><strong class="sensitive">${money.format(v)}</strong></div>`).join("")}</article>`;
}
function renderSummary(){
  const items=monthTransactions(), a=analytics(items), s=state.data.settings;
  $("#summary-period").textContent=new Intl.DateTimeFormat("pt-BR",{month:"long",year:"numeric"}).format(new Date());
  $("#summary-balance").textContent=money.format(a.balance);$("#summary-income").textContent=money.format(a.income);$("#summary-expense").textContent=money.format(a.expense);
  $("#summary-savings").textContent=money.format(a.balance);$("#summary-rate").textContent=`${Math.round(a.savingRate)}%`;
  const spendingBudget=Math.max((s.expectedMonthlyIncome||0)-(s.monthlySavingGoal||0),0);
  const used=spendingBudget?Math.round(a.expense/spendingBudget*100):0, remaining=Math.max(spendingBudget-a.expense,0);
  $("#budget-percent").textContent=spendingBudget?`${used}%`:"—";$("#budget-bar").style.width=`${Math.min(used,100)}%`;$("#remaining-budget").textContent=money.format(remaining);
  $("#pace-message").textContent=!items.length?"Os números aparecem quando vocês começarem.":used>90?"Atenção ao ritmo deste mês. A meta ainda é possível.":used>70?"Talvez valha revisar os próximos gastos com calma.":"Vocês têm boa margem para o restante do mês.";
  const ranking=[...items].filter(x=>x.type==="expense").sort((a,b)=>b.amount-a.amount).slice(0,5);
  $("#summary-analyses").innerHTML=chart("Gastos por categoria",a.byCategory)+chart("Gastos por pessoa",a.byPerson)+chart("Classificação",a.byClassification)+
    `<article class="chart-card"><h3>Projeção</h3><div class="rank-list"><div class="rank-item"><span>Média diária</span><strong class="sensitive">${money.format(a.daily)}</strong></div><div class="rank-item"><span>Previsão de fechamento</span><strong class="sensitive">${money.format(a.forecast)}</strong></div></div></article>`+
    (ranking.length?`<article class="chart-card"><h3>Maiores gastos</h3><div class="rank-list">${ranking.map(x=>`<div class="rank-item"><span>${esc(x.name)}</span><strong class="sensitive">${money.format(x.amount)}</strong></div>`).join("")}</div></article>`:"");
}

function renderSettings(){
  const s=state.data.settings;$("#person1").value=s.person1Name;$("#person2").value=s.person2Name;$("#expected-income").value=moneyInput(s.expectedMonthlyIncome);$("#saving-goal").value=moneyInput(s.monthlySavingGoal);
  $("#toggle-home-values .toggle").classList.toggle("on",!s.hideValuesOnHome);$("#toggle-privacy .toggle").classList.toggle("on",s.privacyMode);
  $("#categories-input").value=state.data.categories.join(", ");$("#payments-input").value=state.data.paymentMethods.join(", ");
  $("#fixed-list").innerHTML=state.data.fixedExpenses.length?state.data.fixedExpenses.map(f=>`<article class="fixed-item"><div><div><h3>${esc(f.name)}</h3><p class="sensitive">${money.format(f.amount)} · vence dia ${f.dueDay} · ${f.active?"Ativo":"Inativo"}</p></div><div><button data-fixed-pay="${f.id}">Marcar pago</button><button data-fixed-edit="${f.id}">Editar</button><button data-fixed-delete="${f.id}">×</button></div></div></article>`).join(""):empty("↻","Nenhum gasto fixo","Cadastre contas recorrentes e gere o lançamento com um toque.");
  $("#category-budgets").innerHTML=state.data.categories.map(c=>`<label class="budget-row"><span>${esc(c)}</span><input inputmode="decimal" data-budget="${esc(c)}" value="${moneyInput(s.categoryBudgets[c]||0)}" placeholder="R$ 0,00"></label>`).join("");
  bindDynamicActions();
}
function render(){
  renderSelects();renderHome();renderLaunch();renderTransactions();renderSummary();renderSettings();
  document.body.classList.toggle("privacy",state.data.settings.privacyMode);
  $("#avatar-1").textContent=(state.data.settings.person1Name||"V")[0].toUpperCase();$("#avatar-2").textContent=(state.data.settings.person2Name||"P")[0].toUpperCase();
}

function resetTransactionForm(){
  $("#transaction-form").reset();$("#transaction-id").value="";state.amountDigits="";state.entryType="expense";state.receiptFile=null;
  $("#launch-title").textContent="Lançar";$("#receipt-name").textContent="";$("#transaction-date").value=today();$("#optional-fields").classList.remove("open");
  $$("[data-entry-type]").forEach(b=>b.classList.toggle("active",b.dataset.entryType==="expense"));renderLaunch();
}
function fillTransaction(t){
  state.entryType=t.type;state.amountDigits=String(Math.round(t.amount*100));$("#transaction-id").value=t.id;$("#transaction-name").value=t.name;$("#transaction-category").value=t.category||"";$("#transaction-paid-by").value=t.paidBy||"";$("#transaction-classification").value=t.classification||"Não classificado";$("#transaction-payment").value=t.paymentMethod||"";$("#transaction-date").value=t.date;$("#launch-title").textContent="Editar lançamento";$("#optional-fields").classList.add("open");
  $$("[data-entry-type]").forEach(b=>b.classList.toggle("active",b.dataset.entryType===t.type));renderLaunch();navigate("launch");
}

function openModal(id){document.body.classList.add("modal-open");$("#modal-backdrop").classList.add("active");$(`#${id}`).classList.add("active")}
function closeModal(){document.body.classList.remove("modal-open");$("#modal-backdrop").classList.remove("active");$$(".modal").forEach(m=>m.classList.remove("active"))}
function bindDynamicActions(){
  $$("[data-edit]").forEach(b=>b.onclick=()=>fillTransaction(state.data.transactions.find(t=>t.id===b.dataset.edit)));
  $$("[data-delete]").forEach(b=>b.onclick=()=>{if(confirm("Excluir este lançamento?")){state.data.transactions=state.data.transactions.filter(t=>t.id!==b.dataset.delete);persist("transactions");render();toast("Lançamento excluído.")}});
  $$("[data-receipt]").forEach(b=>b.onclick=()=>showReceipt(state.data.transactions.find(t=>t.id===b.dataset.receipt)));
  $$("[data-fixed-edit]").forEach(b=>b.onclick=()=>openFixed(state.data.fixedExpenses.find(f=>f.id===b.dataset.fixedEdit)));
  $$("[data-fixed-delete]").forEach(b=>b.onclick=()=>{if(confirm("Excluir este gasto fixo?")){state.data.fixedExpenses=state.data.fixedExpenses.filter(f=>f.id!==b.dataset.fixedDelete);persist("fixedExpenses");render()}});
  $$("[data-fixed-pay]").forEach(b=>b.onclick=()=>generateFixed(state.data.fixedExpenses.find(f=>f.id===b.dataset.fixedPay)));
}

function openFixed(f=null){
  $("#fixed-form").reset();$("#fixed-id").value=f?.id||"";$("#fixed-name").value=f?.name||"";$("#fixed-amount").value=moneyInput(f?.amount||0);$("#fixed-due").value=f?.dueDay||10;$("#fixed-category").value=f?.category||state.data.categories[0];$("#fixed-paid-by").value=f?.paidBy||"";$("#fixed-active").checked=f?.active??true;$("#fixed-title").textContent=f?"Editar gasto fixo":"Novo gasto fixo";openModal("fixed-modal");
}
function generateFixed(f){
  const month=currentMonth(), exists=state.data.transactions.some(t=>t.fixedExpenseId===f.id&&t.date.startsWith(month));
  if(exists){toast("Esse fixo já foi lançado neste mês.");return}
  const day=Math.min(f.dueDay,new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate());
  state.data.transactions.unshift({id:id(),date:`${month}-${String(day).padStart(2,"0")}`,name:f.name,amount:f.amount,type:"expense",category:f.category,paidBy:f.paidBy,classification:"Essencial",paymentMethod:"",fixedExpenseId:f.id,receiptImageId:null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
  persist("transactions");render();toast("Gasto fixo lançado no mês.");
}

async function receiptDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open("baya-receipts",1);r.onupgradeneeded=()=>r.result.createObjectStore("images");r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function saveReceipt(file,receiptId){const db=await receiptDB();return new Promise((res,rej)=>{const tx=db.transaction("images","readwrite");tx.objectStore("images").put(file,receiptId);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}
async function getReceipt(receiptId){const db=await receiptDB();return new Promise((res,rej)=>{const r=db.transaction("images").objectStore("images").get(receiptId);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function showReceipt(t){try{const blob=t.receiptImageId?await getReceipt(t.receiptImageId):null;$("#receipt-preview").src=blob?URL.createObjectURL(blob):t.receiptData;openModal("receipt-modal")}catch{toast("Não foi possível abrir a foto.")}}
function fileDataURL(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)})}

function exportBackup(){
  const blob=new Blob([JSON.stringify({...state.data,exportedAt:new Date().toISOString()},null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`baya-cash-backup-${today()}.json`;a.click();URL.revokeObjectURL(a.href);toast("Backup exportado.");
}
async function importBackup(file){
  try{const parsed=JSON.parse(await file.text());["transactions","fixedExpenses","settings","categories","paymentMethods"].forEach(k=>{if(parsed[k])state.data[k]=parsed[k]});persistAll();render();toast("Backup importado.")}catch{toast("Arquivo de backup inválido.")}
}

$$("[data-go]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.go)));
$$("[data-entry-type]").forEach(b=>b.addEventListener("click",()=>{state.entryType=b.dataset.entryType;$$("[data-entry-type]").forEach(x=>x.classList.toggle("active",x===b))}));
$$("[data-key]").forEach(b=>b.addEventListener("click",()=>{const k=b.dataset.key;if(k==="clear")state.amountDigits="";else if(k==="back")state.amountDigits=state.amountDigits.slice(0,-1);else if(state.amountDigits.length<10)state.amountDigits+=k;renderLaunch()}));
$("#details-toggle").onclick=()=>$("#optional-fields").classList.toggle("open");
$("#transaction-name").addEventListener("input",e=>{const c=suggestCategory(e.target.value);$("#category-suggestion").textContent=c?`Sugestão: ${c}`:"";if(c)$("#transaction-category").value=c});
$("#receipt-input").onchange=e=>{state.receiptFile=e.target.files[0]||null;$("#receipt-name").textContent=state.receiptFile?state.receiptFile.name:""};
$("#transaction-form").addEventListener("submit",async e=>{
  e.preventDefault();const amount=Number(state.amountDigits)/100,name=$("#transaction-name").value.trim();if(!amount||!name){toast("Informe o valor e o nome.");return}
  const existing=state.data.transactions.find(t=>t.id===$("#transaction-id").value), now=new Date().toISOString(), receiptId=state.receiptFile?id():existing?.receiptImageId||null;
  let receiptData=existing?.receiptData||null;if(state.receiptFile){try{await saveReceipt(state.receiptFile,receiptId)}catch{receiptData=await fileDataURL(state.receiptFile)}}
  const item={id:existing?.id||id(),date:$("#transaction-date").value||today(),name,amount,type:state.entryType,category:$("#transaction-category").value,paidBy:$("#transaction-paid-by").value,classification:$("#transaction-classification").value,paymentMethod:$("#transaction-payment").value,fixedExpenseId:existing?.fixedExpenseId||null,receiptImageId:receiptId,receiptData,createdAt:existing?.createdAt||now,updatedAt:now};
  state.data.transactions=existing?state.data.transactions.map(t=>t.id===existing.id?item:t):[item,...state.data.transactions];persist("transactions");resetTransactionForm();render();toast(existing?"Lançamento atualizado.":"Lançamento salvo.");
});
$("#repeat-last").onclick=()=>{const t=state.data.transactions[0];if(!t)return;fillTransaction({...t,id:"",date:today()});$("#transaction-id").value="";$("#launch-title").textContent="Repetir lançamento"};

$("#month-filter").value=state.filter.month;$("#month-filter").onchange=e=>{state.filter.month=e.target.value;renderTransactions()};$("#type-filter").onchange=e=>{state.filter.type=e.target.value;renderTransactions()};$("#category-filter").onchange=e=>{state.filter.category=e.target.value;renderTransactions()};$("#search-filter").oninput=e=>{state.filter.search=e.target.value;renderTransactions()};
$("#privacy-eye").onclick=()=>{state.data.settings.privacyMode=!state.data.settings.privacyMode;persist("settings");render()};
$("#save-settings").onclick=()=>{const s=state.data.settings;s.person1Name=$("#person1").value.trim()||"Você";s.person2Name=$("#person2").value.trim()||"Parceira";s.expectedMonthlyIncome=parseMoney($("#expected-income").value);s.monthlySavingGoal=parseMoney($("#saving-goal").value);persist("settings");render();toast("Preferências salvas.")};
$("#toggle-home-values").onclick=()=>{state.data.settings.hideValuesOnHome=!state.data.settings.hideValuesOnHome;persist("settings");render()};
$("#toggle-privacy").onclick=()=>{state.data.settings.privacyMode=!state.data.settings.privacyMode;persist("settings");render()};
$("#save-lists").onclick=()=>{state.data.categories=$("#categories-input").value.split(",").map(x=>x.trim()).filter(Boolean);state.data.paymentMethods=$("#payments-input").value.split(",").map(x=>x.trim()).filter(Boolean);const budgets={};$$("[data-budget]").forEach(i=>budgets[i.dataset.budget]=parseMoney(i.value));state.data.settings.categoryBudgets=budgets;persist("categories");persist("paymentMethods");persist("settings");render();toast("Listas atualizadas.")};
$("#add-fixed").onclick=()=>openFixed();$("#fixed-form").onsubmit=e=>{e.preventDefault();const old=state.data.fixedExpenses.find(f=>f.id===$("#fixed-id").value),now=new Date().toISOString();const f={id:old?.id||id(),name:$("#fixed-name").value.trim(),amount:parseMoney($("#fixed-amount").value),category:$("#fixed-category").value,dueDay:Number($("#fixed-due").value)||1,paidBy:$("#fixed-paid-by").value,active:$("#fixed-active").checked,createdAt:old?.createdAt||now,updatedAt:now};state.data.fixedExpenses=old?state.data.fixedExpenses.map(x=>x.id===old.id?f:x):[f,...state.data.fixedExpenses];persist("fixedExpenses");closeModal();render();toast("Gasto fixo salvo.")};
$("#export-backup").onclick=exportBackup;$("#import-backup").onchange=e=>e.target.files[0]&&importBackup(e.target.files[0]);
$("#clear-data").onclick=()=>{if(!confirm("Primeira confirmação: apagar todos os dados do Baya Cash?"))return;if(!confirm("Confirma novamente? Essa ação não pode ser desfeita."))return;state.data=clone(defaults);persistAll();resetTransactionForm();navigate("home");toast("Todos os dados foram limpos.")};
$("#modal-backdrop").onclick=closeModal;$$("[data-close-modal]").forEach(b=>b.onclick=closeModal);

renderSelects();resetTransactionForm();render();
