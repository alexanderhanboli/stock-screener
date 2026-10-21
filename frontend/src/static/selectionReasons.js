import {evaluateCondition,evaluateExpression,evaluateGroup,rowValue} from '../features/scan/filterExpressionEvaluator';
import {canonicalizeExpression} from '../features/scan/filterExpressionModel';
import {fieldMeta} from '../features/scan/scanFilterFields';
const names={volume:'成交额',listing_aware_volume:'成交额（上市历史规则）',price:'价格',rs_rating:'相对强度 RS',composite_score:'综合分',market_cap_usd:'市值（美元）',eps_growth_qq:'盈利增长',sales_growth_qq:'营收增长',passes_template:'通过趋势模板',vcp_detected:'检测到VCP形态',stage:'趋势阶段',ma_alignment:'均线排列',market:'市场',gics_sector:'板块'};
const num=(v)=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('zh-CN',{maximumFractionDigits:2}):v==null?'未提供':typeof v==='boolean'?(v?'是':'否'):Array.isArray(v)?v.join('、'):String(v);
function conditionText(c,row){
 const label=names[c.field]||fieldMeta(c.field).label;const actual=rowValue(row,c.field);
 const unit=['volume','listing_aware_volume'].includes(c.field)?` ${row.currency||'本币'}`:'';
 let rule;
 if(c.kind==='range')rule=[c.min!=null?`≥ ${num(c.min)}${unit}`:'',c.max!=null?`≤ ${num(c.max)}${unit}`:''].filter(Boolean).join(' 且 ')||'不限范围';
 else if(c.kind==='boolean')rule=`= ${num(c.value)}`;
 else if(c.kind==='categorical')rule=`${c.mode==='exclude'?'不属于':'属于'} ${num(c.values)}`;
 else rule=`包含“${c.pattern||''}”`;
 return {field:c.field,label,rule,actual:actual===Number.POSITIVE_INFINITY?'上市历史规则豁免（不是实际成交额）':num(actual)+(actual!=null?unit:''),passed:evaluateCondition(row,c),raw:actual};
}
const modelFields=[['minervini','Minervini 趋势','minervini_score'],['canslim','CANSLIM 成长','canslim_score'],['ipo','IPO 上市特征','ipo_score'],['custom','自定义模型','custom_score'],['volume_breakthrough','成交量突破','volume_breakthrough_score'],['setup_engine','形态引擎','se_setup_score']];
const missingNames={insider_ownership:'内部人持股比例',institutional_ownership:'机构持股比例',short_interest:'空头股数'};
export function buildSelectionReasons(row,{expression,asOfDate,screenName,rank,sortBy,sortOrder}={}){
 const exp=canonicalizeExpression(expression);const groups=[exp.required,...exp.groups.filter(g=>g.enabled!==false)].filter(g=>g.enabled!==false).map((g,i)=>({id:g.id,name:i===0?'必须满足的条件':g.name||'条件组',match:g.match,passed:evaluateGroup(row,g),conditions:g.conditions.map(c=>conditionText(c,row))}));
 const strengths=[],cautions=[];const finite=k=>typeof row[k]==='number'&&Number.isFinite(row[k]);
 if(finite('rs_rating'))strengths.push(`相对强度 RS 为 ${num(row.rs_rating)}/100${row.rs_rating>=80?'，处于较高区间':''}。`);
 if(row.ma_alignment===true)strengths.push('快照的均线排列检查通过。');
 if(row.power_trend===true)strengths.push('快照识别到 Power Trend（强趋势）信号。');
 if(row.passes_template===true)strengths.push('通过 Minervini 趋势模板。');
 const basis=row.growth_metric_basis==='quarterly_qoq'?'季度环比':row.growth_metric_basis==='comparable_period_yoy'?'可比同期':'快照口径';
 for(const [field,label] of [['eps_growth_qq','盈利'],['sales_growth_qq','营收']])if(finite(field)){
  const line=`${label}${basis}增长 ${num(row[field])}%。`;(row[field]>0?strengths:cautions).push(line);
 }
 if(row.vcp_detected===true)strengths.push('已检测到 VCP（波动收敛）形态。');
 if(row.se_pattern_primary)strengths.push(`形态引擎识别为 ${{cup_with_handle:'杯柄',double_bottom:'双底',high_tight_flag:'高紧旗形',flat_base:'平底'}[row.se_pattern_primary]||row.se_pattern_primary}；形态识别不等于买入触发。`);
 if(row.passes_template===false)cautions.push('尚未通过完整 Minervini 趋势模板。');
 if(row.se_setup_ready===false)cautions.push('形态引擎的入场准备条件尚未全部满足。');
 if(row.stage===3||row.stage===4)cautions.push(`趋势阶段为 ${row.stage}（${row.stage===3?'顶部整理':'下降'}阶段），不能按第二阶段上升趋势理解。`);
 if(row.action_state==='event_risk'||row.opportunity_state?.action_reasons?.includes('earnings_soon'))cautions.push('近期财报事件风险：快照标记 earnings_soon，具体日期未在此返回。');
 if(row.action_state==='extended'||row.se_extended_from_pivot===true)cautions.push('价格延伸偏大；入选不表示当前位置仍适合追入。');
 if(row.action_state==='exit_risk'||row.action_state==='deteriorating')cautions.push('快照提示结构失效或趋势走弱风险。');
 if(row.data_status&&row.data_status!=='complete')cautions.push(`快照数据状态：${row.data_status}。`);
 const missing=Object.entries(row.field_availability||{}).filter(([,v])=>['missing','unavailable','unsupported'].includes(v?.status)).map(([k,v])=>({field:k,label:missingNames[k]||names[k]||fieldMeta(k).label,status:v.status,reason:v.reason_code}));
 const models=modelFields.filter(([id,,field])=>row.screeners_run?.length?row.screeners_run.includes(id):finite(field)).map(([id,name,field])=>({id,name,score:finite(field)?row[field]:null}));
 return {symbol:row.symbol,company:row.company_name,asOfDate:asOfDate||row.opportunity_state?.as_of_date||row.rs_as_of_date||null,screenName:screenName||'当前筛选',matched:evaluateExpression(row,exp),groups,groupJoin:exp.group_join,strengths,cautions,missing,models,composite:finite('composite_score')?row.composite_score:null,rank:rank||null,sortLabel:names[sortBy]||fieldMeta(sortBy||'composite_score').label,sortOrder:sortOrder==='asc'?'从低到高':'从高到低',hasConditions:groups.some(g=>g.conditions.length)};
}
