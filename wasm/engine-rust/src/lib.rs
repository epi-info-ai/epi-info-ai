#![cfg_attr(not(test), no_std)]

#[cfg(not(test))]
use core::panic::PanicInfo;

#[cfg(not(test))]
#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    loop {}
}

fn ratio(numerator: f64, denominator: f64) -> f64 {
    if denominator > 0.0 {
        numerator / denominator
    } else {
        f64::NAN
    }
}

fn valid_confidence_multiplier(z: f64) -> bool {
    z.is_finite() && z > 0.0
}

const MAX_EXACT_SUPPORT: f64 = 100_000.0;
const LEGACY_TWO_SIDED_TOLERANCE: f64 = 1.000_001;
const MAX_STRATA: usize = 1_024;
const MAX_STRATIFIED_EXACT_WIDTH: usize = 4_096;
const MAX_STRATIFIED_EXACT_WORK: usize = 2_000_000;
static mut STRATIFIED_TABLES: [[f64; 4]; MAX_STRATA] = [[0.0; 4]; MAX_STRATA];
static mut STRATIFIED_EXACT_CURRENT: [f64; MAX_STRATIFIED_EXACT_WIDTH + 1] =
    [0.0; MAX_STRATIFIED_EXACT_WIDTH + 1];
static mut STRATIFIED_EXACT_NEXT: [f64; MAX_STRATIFIED_EXACT_WIDTH + 1] =
    [0.0; MAX_STRATIFIED_EXACT_WIDTH + 1];
static mut STRATIFIED_EXACT_STRATUM: [f64; MAX_STRATIFIED_EXACT_WIDTH + 1] =
    [0.0; MAX_STRATIFIED_EXACT_WIDTH + 1];
#[cfg(test)]
static STRATIFIED_TEST_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

fn valid_stratified_count(value: f64) -> bool {
    value.is_finite() && value >= 0.0 && value == libm::floor(value)
}

#[unsafe(no_mangle)]
pub extern "C" fn stratified_set_table(index: u32, a: f64, b: f64, c: f64, d: f64) -> i32 {
    let index = index as usize;
    if index >= MAX_STRATA
        || ![a, b, c, d]
            .iter()
            .all(|value| valid_stratified_count(*value))
    {
        return 0;
    }
    unsafe {
        STRATIFIED_TABLES[index] = [a, b, c, d];
    }
    1
}

fn stratified_fold(count: u32) -> Option<(f64, f64, f64, f64, f64, f64, f64)> {
    let count = count as usize;
    if count == 0 || count > MAX_STRATA {
        return None;
    }
    let mut or_numerator = 0.0;
    let mut or_denominator = 0.0;
    let mut rr_numerator = 0.0;
    let mut rr_denominator = 0.0;
    let mut rr_variance_numerator = 0.0;
    let mut mh_numerator = 0.0;
    let mut mh_denominator = 0.0;
    let tables = core::ptr::addr_of!(STRATIFIED_TABLES) as *const [f64; 4];
    for index in 0..count {
        let [a, b, c, d] = unsafe { *tables.add(index) };
        let total = a + b + c + d;
        if total <= 0.0 {
            continue;
        }
        let ad_over_n = a * d / total;
        let bc_over_n = b * c / total;
        or_numerator += ad_over_n;
        or_denominator += bc_over_n;
        rr_numerator += a * (c + d) / total;
        rr_denominator += c * (a + b) / total;
        rr_variance_numerator += ((a + c) * (a + b) * (c + d) - a * c * total) / (total * total);
        mh_numerator += (a * d - b * c) / total;
        if total > 1.0 {
            mh_denominator +=
                (a + b) * (c + d) * (a + c) * (b + d) / ((total - 1.0) * total * total);
        }
    }
    Some((
        or_numerator,
        or_denominator,
        rr_numerator,
        rr_denominator,
        rr_variance_numerator,
        mh_numerator,
        mh_denominator,
    ))
}

#[unsafe(no_mangle)]
pub extern "C" fn stratified_mh_odds_ratio(count: u32) -> f64 {
    stratified_fold(count).map_or(f64::NAN, |values| ratio(values.0, values.1))
}

fn stratified_mh_odds_ratio_interval(count: u32, z: f64, upper: bool) -> f64 {
    let Some((r, s, _, _, _, _, _)) = stratified_fold(count) else {
        return f64::NAN;
    };
    let estimate = ratio(r, s);
    if !valid_confidence_multiplier(z) || !estimate.is_finite() || r <= 0.0 || s <= 0.0 {
        return f64::NAN;
    }
    let mut p1 = 0.0;
    let mut p2 = 0.0;
    let mut p3 = 0.0;
    let tables = core::ptr::addr_of!(STRATIFIED_TABLES) as *const [f64; 4];
    for index in 0..count as usize {
        let [a, b, c, d] = unsafe { *tables.add(index) };
        let total = a + b + c + d;
        if total <= 0.0 {
            continue;
        }
        let ad = a * d / total;
        let bc = b * c / total;
        p1 += (a + d) / total * ad;
        p2 += (a + d) / total * bc + (b + c) / total * ad;
        p3 += (b + c) / total * bc;
    }
    let standard_error = libm::sqrt(p1 / (2.0 * r * r) + p2 / (2.0 * r * s) + p3 / (2.0 * s * s));
    let direction = if upper { 1.0 } else { -1.0 };
    libm::exp(libm::log(estimate) + direction * z * standard_error)
}

#[unsafe(no_mangle)]
pub extern "C" fn stratified_mh_odds_ratio_ci_lower(count: u32, z: f64) -> f64 {
    stratified_mh_odds_ratio_interval(count, z, false)
}

#[unsafe(no_mangle)]
pub extern "C" fn stratified_mh_odds_ratio_ci_upper(count: u32, z: f64) -> f64 {
    stratified_mh_odds_ratio_interval(count, z, true)
}

#[unsafe(no_mangle)]
pub extern "C" fn stratified_mh_risk_ratio(count: u32) -> f64 {
    stratified_fold(count).map_or(f64::NAN, |values| ratio(values.2, values.3))
}

fn stratified_mh_risk_ratio_interval(count: u32, z: f64, upper: bool) -> f64 {
    let Some((_, _, numerator, denominator, variance_numerator, _, _)) = stratified_fold(count)
    else {
        return f64::NAN;
    };
    let estimate = ratio(numerator, denominator);
    if !valid_confidence_multiplier(z)
        || !estimate.is_finite()
        || numerator <= 0.0
        || denominator <= 0.0
    {
        return f64::NAN;
    }
    let standard_error = libm::sqrt(variance_numerator / (numerator * denominator));
    let direction = if upper { 1.0 } else { -1.0 };
    libm::exp(libm::log(estimate) + direction * z * standard_error)
}

#[unsafe(no_mangle)]
pub extern "C" fn stratified_mh_risk_ratio_ci_lower(count: u32, z: f64) -> f64 {
    stratified_mh_risk_ratio_interval(count, z, false)
}

#[unsafe(no_mangle)]
pub extern "C" fn stratified_mh_risk_ratio_ci_upper(count: u32, z: f64) -> f64 {
    stratified_mh_risk_ratio_interval(count, z, true)
}

fn stratified_mh_chi_square(count: u32, corrected: bool) -> f64 {
    let Some((_, _, _, _, _, numerator, denominator)) = stratified_fold(count) else {
        return f64::NAN;
    };
    let adjusted = if corrected {
        (numerator.abs() - 0.5).max(0.0)
    } else {
        numerator
    };
    ratio(adjusted * adjusted, denominator)
}

#[unsafe(no_mangle)]
pub extern "C" fn stratified_mh_chi_square_uncorrected(count: u32) -> f64 {
    stratified_mh_chi_square(count, false)
}

#[unsafe(no_mangle)]
pub extern "C" fn stratified_mh_chi_square_corrected(count: u32) -> f64 {
    stratified_mh_chi_square(count, true)
}

fn breslow_day_components(count: u32) -> Option<(f64, f64)> {
    if count < 2 {
        return None;
    }
    let common_odds = stratified_mh_odds_ratio(count);
    if !common_odds.is_finite() || common_odds <= 0.0 {
        return None;
    }
    let tables = core::ptr::addr_of!(STRATIFIED_TABLES) as *const [f64; 4];
    let mut statistic = 0.0;
    let mut observed_sum = 0.0;
    let mut expected_sum = 0.0;
    let mut variance_sum = 0.0;
    for index in 0..count as usize {
        let [observed, b, c, d] = unsafe { *tables.add(index) };
        let cases = observed + c;
        let non_cases = b + d;
        let exposed = observed + b;
        let total = cases + non_cases;
        let mut lower = (exposed - non_cases).max(0.0);
        let mut upper = exposed.min(cases);
        if total <= 1.0 || lower >= upper {
            return None;
        }
        for _ in 0..160 {
            let expected = 0.5 * (lower + upper);
            let cell_b = exposed - expected;
            let cell_c = cases - expected;
            let cell_d = non_cases - exposed + expected;
            let odds = expected * cell_d / (cell_b * cell_c);
            if odds < common_odds {
                lower = expected;
            } else {
                upper = expected;
            }
        }
        let expected = 0.5 * (lower + upper);
        let cell_b = exposed - expected;
        let cell_c = cases - expected;
        let cell_d = non_cases - exposed + expected;
        if expected <= 0.0 || cell_b <= 0.0 || cell_c <= 0.0 || cell_d <= 0.0 {
            return None;
        }
        let variance = 1.0 / (1.0 / expected + 1.0 / cell_b + 1.0 / cell_c + 1.0 / cell_d);
        if !variance.is_finite() || variance <= 0.0 {
            return None;
        }
        statistic += (observed - expected) * (observed - expected) / variance;
        observed_sum += observed;
        expected_sum += expected;
        variance_sum += variance;
    }
    let correction = (observed_sum - expected_sum) * (observed_sum - expected_sum) / variance_sum;
    Some((statistic.max(0.0), (statistic - correction).max(0.0)))
}

#[unsafe(no_mangle)]
pub extern "C" fn stratified_breslow_day_odds_ratio(count: u32) -> f64 {
    breslow_day_components(count).map_or(f64::NAN, |values| values.0)
}

#[unsafe(no_mangle)]
pub extern "C" fn stratified_breslow_day_tarone_odds_ratio(count: u32) -> f64 {
    breslow_day_components(count).map_or(f64::NAN, |values| values.1)
}

#[unsafe(no_mangle)]
pub extern "C" fn stratified_legacy_woolf_odds_ratio(count: u32) -> f64 {
    if count < 2 {
        return f64::NAN;
    }
    let tables = core::ptr::addr_of!(STRATIFIED_TABLES) as *const [f64; 4];
    let mut weighted_log_sum = 0.0;
    let mut weight_sum = 0.0;
    for index in 0..count as usize {
        let [a, b, c, d] = unsafe { *tables.add(index) };
        if a <= 0.0 || b <= 0.0 || c <= 0.0 || d <= 0.0 {
            return f64::NAN;
        }
        let weight = 1.0 / (1.0 / a + 1.0 / b + 1.0 / c + 1.0 / d);
        weighted_log_sum += weight * libm::log(a * d / (b * c));
        weight_sum += weight;
    }
    if weight_sum <= 0.0 {
        return f64::NAN;
    }
    let pooled_log_odds = weighted_log_sum / weight_sum;
    let mut statistic = 0.0;
    for index in 0..count as usize {
        let [a, b, c, d] = unsafe { *tables.add(index) };
        let weight = 1.0 / (1.0 / a + 1.0 / b + 1.0 / c + 1.0 / d);
        let difference = libm::log(a * d / (b * c)) - pooled_log_odds;
        statistic += difference * difference * weight;
    }
    statistic
}

#[unsafe(no_mangle)]
pub extern "C" fn stratified_legacy_woolf_risk_ratio(count: u32) -> f64 {
    if count < 2 {
        return f64::NAN;
    }
    let tables = core::ptr::addr_of!(STRATIFIED_TABLES) as *const [f64; 4];
    let mut weighted_log_sum = 0.0;
    let mut weight_sum = 0.0;
    for index in 0..count as usize {
        let [a, b, c, d] = unsafe { *tables.add(index) };
        if a <= 0.0 || c <= 0.0 {
            return f64::NAN;
        }
        let risk_ratio = (a / (a + b)) / (c / (c + d));
        let variance = b / (a * (a + b)) + d / (c * (c + d));
        if !risk_ratio.is_finite() || risk_ratio <= 0.0 || !variance.is_finite() || variance <= 0.0
        {
            return f64::NAN;
        }
        let weight = 1.0 / variance;
        weighted_log_sum += weight * libm::log(risk_ratio);
        weight_sum += weight;
    }
    if !weight_sum.is_finite() || weight_sum <= 0.0 {
        return f64::NAN;
    }
    let pooled_log_risk = weighted_log_sum / weight_sum;
    let mut statistic = 0.0;
    for index in 0..count as usize {
        let [a, b, c, d] = unsafe { *tables.add(index) };
        let risk_ratio = (a / (a + b)) / (c / (c + d));
        let weight = 1.0 / (b / (a * (a + b)) + d / (c * (c + d)));
        let difference = libm::log(risk_ratio) - pooled_log_risk;
        statistic += difference * difference * weight;
    }
    statistic
}

fn stratified_exact_coefficients(count: u32) -> Option<(usize, usize)> {
    let count = count as usize;
    if count == 0 || count > MAX_STRATA {
        return None;
    }
    let tables = core::ptr::addr_of!(STRATIFIED_TABLES) as *const [f64; 4];
    let current = core::ptr::addr_of_mut!(STRATIFIED_EXACT_CURRENT) as *mut f64;
    let next = core::ptr::addr_of_mut!(STRATIFIED_EXACT_NEXT) as *mut f64;
    let stratum = core::ptr::addr_of_mut!(STRATIFIED_EXACT_STRATUM) as *mut f64;
    unsafe { *current = 1.0 };
    let mut current_width = 0usize;
    let mut observed_index = 0usize;
    let mut work = 0usize;
    for table_index in 0..count {
        let [a, b, c, d] = unsafe { *tables.add(table_index) };
        if [a, b, c, d]
            .iter()
            .any(|value| !valid_stratified_count(*value) || *value > 999_999.0)
        {
            return None;
        }
        let cases = a + c;
        let non_cases = b + d;
        let exposed = a + b;
        let lower = (exposed - non_cases).max(0.0);
        let upper = exposed.min(cases);
        let stratum_width = (upper - lower) as usize;
        if current_width + stratum_width > MAX_STRATIFIED_EXACT_WIDTH {
            return None;
        }
        work = work.checked_add((current_width + 1) * (stratum_width + 1))?;
        if work > MAX_STRATIFIED_EXACT_WORK {
            return None;
        }
        observed_index = observed_index.checked_add((a - lower) as usize)?;
        let mut maximum_log = f64::NEG_INFINITY;
        for index in 0..=stratum_width {
            let cell = lower + index as f64;
            let coefficient_log = log_choose(cases, cell) + log_choose(non_cases, exposed - cell);
            maximum_log = maximum_log.max(coefficient_log);
            unsafe { *stratum.add(index) = coefficient_log };
        }
        for index in 0..=stratum_width {
            unsafe { *stratum.add(index) = libm::exp(*stratum.add(index) - maximum_log) };
        }
        let next_width = current_width + stratum_width;
        for index in 0..=next_width {
            unsafe { *next.add(index) = 0.0 };
        }
        for left in 0..=current_width {
            for right in 0..=stratum_width {
                unsafe { *next.add(left + right) += *current.add(left) * *stratum.add(right) };
            }
        }
        let mut maximum = 0.0_f64;
        for index in 0..=next_width {
            maximum = maximum.max(unsafe { *next.add(index) });
        }
        if !maximum.is_finite() || maximum <= 0.0 {
            return None;
        }
        for index in 0..=next_width {
            unsafe { *current.add(index) = *next.add(index) / maximum };
        }
        current_width = next_width;
    }
    if observed_index > current_width {
        None
    } else {
        Some((current_width, observed_index))
    }
}

fn stratified_exact_distribution(
    width: usize,
    observed_index: usize,
    log_odds_ratio: f64,
) -> Option<(f64, f64, f64)> {
    if !log_odds_ratio.is_finite() || observed_index > width {
        return None;
    }
    let coefficients = core::ptr::addr_of!(STRATIFIED_EXACT_CURRENT) as *const f64;
    let mut maximum_log = f64::NEG_INFINITY;
    for index in 0..=width {
        let coefficient = unsafe { *coefficients.add(index) };
        if coefficient > 0.0 {
            maximum_log = maximum_log.max(libm::log(coefficient) + index as f64 * log_odds_ratio);
        }
    }
    if !maximum_log.is_finite() {
        return None;
    }
    let mut denominator = 0.0;
    let mut mean = 0.0;
    let mut lower_tail = 0.0;
    let mut upper_tail = 0.0;
    for index in 0..=width {
        let coefficient = unsafe { *coefficients.add(index) };
        if coefficient <= 0.0 {
            continue;
        }
        let weight =
            libm::exp(libm::log(coefficient) + index as f64 * log_odds_ratio - maximum_log);
        denominator += weight;
        mean += index as f64 * weight;
        if index <= observed_index {
            lower_tail += weight;
        }
        if index >= observed_index {
            upper_tail += weight;
        }
    }
    if !denominator.is_finite() || denominator <= 0.0 {
        None
    } else {
        Some((
            mean / denominator,
            lower_tail / denominator,
            upper_tail / denominator,
        ))
    }
}

fn stratified_exact_root(count: u32, confidence_level: Option<f64>, target: u8) -> f64 {
    let Some((width, observed)) = stratified_exact_coefficients(count) else {
        return f64::NAN;
    };
    if target == 0 && observed == 0 {
        return 0.0;
    }
    if target == 0 && observed == width {
        return f64::INFINITY;
    }
    if target == 1 && observed == 0 {
        return 0.0;
    }
    if target == 2 && observed == width {
        return f64::INFINITY;
    }
    let tail_probability = if let Some(level) = confidence_level {
        if !level.is_finite() || level <= 0.0 || level >= 1.0 {
            return f64::NAN;
        }
        0.5 * (1.0 - level)
    } else {
        0.0
    };
    let mut lower = -700.0;
    let mut upper = 700.0;
    for _ in 0..192 {
        let midpoint = 0.5 * (lower + upper);
        let Some((mean, lower_tail, upper_tail)) =
            stratified_exact_distribution(width, observed, midpoint)
        else {
            return f64::NAN;
        };
        let move_lower_up = match target {
            0 => mean < observed as f64,
            1 => upper_tail < tail_probability,
            2 => lower_tail > tail_probability,
            _ => return f64::NAN,
        };
        if move_lower_up {
            lower = midpoint;
        } else {
            upper = midpoint;
        }
    }
    libm::exp(0.5 * (lower + upper))
}

#[unsafe(no_mangle)]
pub extern "C" fn stratified_conditional_odds_ratio(count: u32) -> f64 {
    stratified_exact_root(count, None, 0)
}

#[unsafe(no_mangle)]
pub extern "C" fn stratified_conditional_odds_ratio_fisher_lower(
    count: u32,
    confidence_level: f64,
) -> f64 {
    stratified_exact_root(count, Some(confidence_level), 1)
}

#[unsafe(no_mangle)]
pub extern "C" fn stratified_conditional_odds_ratio_fisher_upper(
    count: u32,
    confidence_level: f64,
) -> f64 {
    stratified_exact_root(count, Some(confidence_level), 2)
}

#[derive(Clone, Copy)]
struct ExactTails {
    left: f64,
    right: f64,
    one_tailed: f64,
    two_tailed: f64,
    mid_p_left: f64,
    mid_p_right: f64,
    mid_p_one_tailed: f64,
}

impl ExactTails {
    fn invalid() -> Self {
        Self {
            left: f64::NAN,
            right: f64::NAN,
            one_tailed: f64::NAN,
            two_tailed: f64::NAN,
            mid_p_left: f64::NAN,
            mid_p_right: f64::NAN,
            mid_p_one_tailed: f64::NAN,
        }
    }
}

fn valid_exact_count(value: f64) -> bool {
    value.is_finite() && value >= 0.0 && value == libm::floor(value)
}

fn log_choose(n: f64, k: f64) -> f64 {
    if k < 0.0 || k > n {
        f64::NEG_INFINITY
    } else {
        libm::lgamma(n + 1.0) - libm::lgamma(k + 1.0) - libm::lgamma(n - k + 1.0)
    }
}

fn log_hypergeometric_probability(
    candidate: f64,
    row_one: f64,
    column_one: f64,
    total: f64,
) -> f64 {
    log_choose(column_one, candidate) + log_choose(total - column_one, row_one - candidate)
        - log_choose(total, row_one)
}

fn exact_tails(a: f64, b: f64, c: f64, d: f64) -> ExactTails {
    if ![a, b, c, d].iter().all(|value| valid_exact_count(*value)) {
        return ExactTails::invalid();
    }

    let row_one = a + b;
    let row_two = c + d;
    let column_one = a + c;
    let total = row_one + row_two;
    if !total.is_finite() || total <= 0.0 {
        return ExactTails::invalid();
    }

    let lower = (row_one - (total - column_one)).max(0.0);
    let upper = row_one.min(column_one);
    if !lower.is_finite()
        || !upper.is_finite()
        || upper < lower
        || upper - lower + 1.0 > MAX_EXACT_SUPPORT
    {
        return ExactTails::invalid();
    }

    let observed_log = log_hypergeometric_probability(a, row_one, column_one, total);
    let mut maximum_log = f64::NEG_INFINITY;
    let mut candidate = lower;
    while candidate <= upper {
        maximum_log = maximum_log.max(log_hypergeometric_probability(
            candidate, row_one, column_one, total,
        ));
        candidate += 1.0;
    }

    let two_sided_log_limit = observed_log + libm::log(LEGACY_TWO_SIDED_TOLERANCE);
    let mut denominator = 0.0;
    let mut left = 0.0;
    let mut right = 0.0;
    let mut two_tailed = 0.0;
    let mut observed = 0.0;
    candidate = lower;
    while candidate <= upper {
        let log_probability = log_hypergeometric_probability(candidate, row_one, column_one, total);
        let scaled_probability = libm::exp(log_probability - maximum_log);
        denominator += scaled_probability;
        if candidate <= a {
            left += scaled_probability;
        }
        if candidate >= a {
            right += scaled_probability;
        }
        if log_probability <= two_sided_log_limit {
            two_tailed += scaled_probability;
        }
        if candidate == a {
            observed = scaled_probability;
        }
        candidate += 1.0;
    }

    if !denominator.is_finite() || denominator <= 0.0 {
        return ExactTails::invalid();
    }
    let left = (left / denominator).min(1.0);
    let right = (right / denominator).min(1.0);
    let observed = observed / denominator;
    let mid_p_left = (left - 0.5 * observed).max(0.0);
    let mid_p_right = (right - 0.5 * observed).max(0.0);
    ExactTails {
        left,
        right,
        one_tailed: left.min(right),
        two_tailed: (two_tailed / denominator).min(1.0),
        mid_p_left,
        mid_p_right,
        mid_p_one_tailed: mid_p_left.min(mid_p_right),
    }
}

#[derive(Clone, Copy)]
struct ExactSupport {
    observed: f64,
    lower: f64,
    upper: f64,
    row_one: f64,
    column_one: f64,
    total: f64,
}

fn exact_support(a: f64, b: f64, c: f64, d: f64) -> Option<ExactSupport> {
    if ![a, b, c, d].iter().all(|value| valid_exact_count(*value)) {
        return None;
    }
    let row_one = a + b;
    let row_two = c + d;
    let column_one = a + c;
    let total = row_one + row_two;
    let lower = (row_one - (total - column_one)).max(0.0);
    let upper = row_one.min(column_one);
    if !total.is_finite()
        || total <= 0.0
        || !lower.is_finite()
        || !upper.is_finite()
        || upper < lower
        || upper - lower + 1.0 > MAX_EXACT_SUPPORT
    {
        None
    } else {
        Some(ExactSupport {
            observed: a,
            lower,
            upper,
            row_one,
            column_one,
            total,
        })
    }
}

#[derive(Clone, Copy)]
struct NoncentralSummary {
    mean: f64,
    below: f64,
    observed: f64,
    above: f64,
}

fn noncentral_summary(support: ExactSupport, log_odds: f64) -> Option<NoncentralSummary> {
    if !log_odds.is_finite() {
        return None;
    }
    let mut maximum_log = f64::NEG_INFINITY;
    let mut candidate = support.lower;
    while candidate <= support.upper {
        let log_weight = log_hypergeometric_probability(
            candidate,
            support.row_one,
            support.column_one,
            support.total,
        ) + (candidate - support.lower) * log_odds;
        maximum_log = maximum_log.max(log_weight);
        candidate += 1.0;
    }

    let mut denominator = 0.0;
    let mut weighted_sum = 0.0;
    let mut below = 0.0;
    let mut observed = 0.0;
    let mut above = 0.0;
    candidate = support.lower;
    while candidate <= support.upper {
        let log_weight = log_hypergeometric_probability(
            candidate,
            support.row_one,
            support.column_one,
            support.total,
        ) + (candidate - support.lower) * log_odds;
        let weight = libm::exp(log_weight - maximum_log);
        denominator += weight;
        weighted_sum += candidate * weight;
        if candidate < support.observed {
            below += weight;
        } else if candidate > support.observed {
            above += weight;
        } else {
            observed = weight;
        }
        candidate += 1.0;
    }
    if !denominator.is_finite() || denominator <= 0.0 {
        None
    } else {
        Some(NoncentralSummary {
            mean: weighted_sum / denominator,
            below: below / denominator,
            observed: observed / denominator,
            above: above / denominator,
        })
    }
}

#[derive(Clone, Copy)]
enum ConditionalRoot {
    Mean,
    FisherLower,
    FisherUpper,
    MidPLower,
    MidPUpper,
}

fn conditional_objective(
    support: ExactSupport,
    root: ConditionalRoot,
    confidence_level: f64,
    log_odds: f64,
) -> Option<f64> {
    let summary = noncentral_summary(support, log_odds)?;
    let alpha_half = 0.5 * (1.0 - confidence_level);
    Some(match root {
        ConditionalRoot::Mean => summary.mean - support.observed,
        ConditionalRoot::FisherLower => summary.above + summary.observed - alpha_half,
        ConditionalRoot::FisherUpper => summary.below + summary.observed - alpha_half,
        ConditionalRoot::MidPLower => summary.above + 0.5 * summary.observed - alpha_half,
        ConditionalRoot::MidPUpper => summary.below + 0.5 * summary.observed - alpha_half,
    })
}

fn solve_conditional_root(
    support: ExactSupport,
    root: ConditionalRoot,
    confidence_level: f64,
) -> f64 {
    let mut low = -700.0;
    let mut high = 700.0;
    let mut low_value = match conditional_objective(support, root, confidence_level, low) {
        Some(value) => value,
        None => return f64::NAN,
    };
    let high_value = match conditional_objective(support, root, confidence_level, high) {
        Some(value) => value,
        None => return f64::NAN,
    };
    if low_value == 0.0 {
        return libm::exp(low);
    }
    if high_value == 0.0 {
        return libm::exp(high);
    }
    if low_value * high_value > 0.0 {
        return f64::NAN;
    }

    let mut iterations = 0;
    while iterations < 160 && high - low > 1.0e-12 {
        let midpoint = 0.5 * (low + high);
        let midpoint_value = match conditional_objective(support, root, confidence_level, midpoint)
        {
            Some(value) => value,
            None => return f64::NAN,
        };
        if midpoint_value == 0.0 {
            return libm::exp(midpoint);
        }
        if low_value * midpoint_value > 0.0 {
            low = midpoint;
            low_value = midpoint_value;
        } else {
            high = midpoint;
        }
        iterations += 1;
    }
    libm::exp(0.5 * (low + high))
}

#[unsafe(no_mangle)]
pub extern "C" fn conditional_odds_ratio(a: f64, b: f64, c: f64, d: f64) -> f64 {
    let support = match exact_support(a, b, c, d) {
        Some(value) => value,
        None => return f64::NAN,
    };
    if support.lower == support.upper {
        return f64::NAN;
    }
    if support.observed == support.lower {
        0.0
    } else if support.observed == support.upper {
        f64::INFINITY
    } else {
        solve_conditional_root(support, ConditionalRoot::Mean, 0.95)
    }
}

fn conditional_odds_ratio_limit(
    a: f64,
    b: f64,
    c: f64,
    d: f64,
    confidence_level: f64,
    root: ConditionalRoot,
) -> f64 {
    if !confidence_level.is_finite() || confidence_level <= 0.0 || confidence_level >= 1.0 {
        return f64::NAN;
    }
    let support = match exact_support(a, b, c, d) {
        Some(value) => value,
        None => return f64::NAN,
    };
    if support.lower == support.upper {
        return f64::NAN;
    }
    if matches!(
        root,
        ConditionalRoot::FisherLower | ConditionalRoot::MidPLower
    ) && support.observed == support.lower
    {
        return 0.0;
    }
    if matches!(
        root,
        ConditionalRoot::FisherUpper | ConditionalRoot::MidPUpper
    ) && support.observed == support.upper
    {
        return f64::INFINITY;
    }
    solve_conditional_root(support, root, confidence_level)
}

#[unsafe(no_mangle)]
pub extern "C" fn conditional_odds_ratio_fisher_lower(
    a: f64,
    b: f64,
    c: f64,
    d: f64,
    confidence_level: f64,
) -> f64 {
    conditional_odds_ratio_limit(a, b, c, d, confidence_level, ConditionalRoot::FisherLower)
}

#[unsafe(no_mangle)]
pub extern "C" fn conditional_odds_ratio_fisher_upper(
    a: f64,
    b: f64,
    c: f64,
    d: f64,
    confidence_level: f64,
) -> f64 {
    conditional_odds_ratio_limit(a, b, c, d, confidence_level, ConditionalRoot::FisherUpper)
}

#[unsafe(no_mangle)]
pub extern "C" fn conditional_odds_ratio_mid_p_lower(
    a: f64,
    b: f64,
    c: f64,
    d: f64,
    confidence_level: f64,
) -> f64 {
    conditional_odds_ratio_limit(a, b, c, d, confidence_level, ConditionalRoot::MidPLower)
}

#[unsafe(no_mangle)]
pub extern "C" fn conditional_odds_ratio_mid_p_upper(
    a: f64,
    b: f64,
    c: f64,
    d: f64,
    confidence_level: f64,
) -> f64 {
    conditional_odds_ratio_limit(a, b, c, d, confidence_level, ConditionalRoot::MidPUpper)
}

#[unsafe(no_mangle)]
pub extern "C" fn fisher_exact_left(a: f64, b: f64, c: f64, d: f64) -> f64 {
    exact_tails(a, b, c, d).left
}

#[unsafe(no_mangle)]
pub extern "C" fn fisher_exact_right(a: f64, b: f64, c: f64, d: f64) -> f64 {
    exact_tails(a, b, c, d).right
}

#[unsafe(no_mangle)]
pub extern "C" fn fisher_exact_one_tailed(a: f64, b: f64, c: f64, d: f64) -> f64 {
    exact_tails(a, b, c, d).one_tailed
}

#[unsafe(no_mangle)]
pub extern "C" fn fisher_exact_two_tailed(a: f64, b: f64, c: f64, d: f64) -> f64 {
    exact_tails(a, b, c, d).two_tailed
}

#[unsafe(no_mangle)]
pub extern "C" fn mid_p_exact_left(a: f64, b: f64, c: f64, d: f64) -> f64 {
    exact_tails(a, b, c, d).mid_p_left
}

#[unsafe(no_mangle)]
pub extern "C" fn mid_p_exact_right(a: f64, b: f64, c: f64, d: f64) -> f64 {
    exact_tails(a, b, c, d).mid_p_right
}

#[unsafe(no_mangle)]
pub extern "C" fn mid_p_exact_one_tailed(a: f64, b: f64, c: f64, d: f64) -> f64 {
    exact_tails(a, b, c, d).mid_p_one_tailed
}

#[unsafe(no_mangle)]
pub extern "C" fn risk_exposed(a: f64, b: f64) -> f64 {
    ratio(a, a + b)
}

#[unsafe(no_mangle)]
pub extern "C" fn risk_unexposed(c: f64, d: f64) -> f64 {
    ratio(c, c + d)
}

#[unsafe(no_mangle)]
pub extern "C" fn risk_ratio(a: f64, b: f64, c: f64, d: f64) -> f64 {
    ratio(risk_exposed(a, b), risk_unexposed(c, d))
}

#[unsafe(no_mangle)]
pub extern "C" fn odds_ratio(a: f64, b: f64, c: f64, d: f64) -> f64 {
    ratio(a * d, b * c)
}

#[unsafe(no_mangle)]
pub extern "C" fn risk_difference(a: f64, b: f64, c: f64, d: f64) -> f64 {
    let exposed = risk_exposed(a, b);
    let unexposed = risk_unexposed(c, d);
    if exposed.is_nan() || unexposed.is_nan() {
        f64::NAN
    } else {
        exposed - unexposed
    }
}

fn odds_ratio_interval(a: f64, b: f64, c: f64, d: f64, z: f64, upper: bool) -> f64 {
    let estimate = odds_ratio(a, b, c, d);
    if !valid_confidence_multiplier(z)
        || !estimate.is_finite()
        || a <= 0.0
        || b <= 0.0
        || c <= 0.0
        || d <= 0.0
    {
        return f64::NAN;
    }
    let standard_error = libm::sqrt(1.0 / a + 1.0 / b + 1.0 / c + 1.0 / d);
    let direction = if upper { 1.0 } else { -1.0 };
    libm::exp(libm::log(estimate) + direction * z * standard_error)
}

#[unsafe(no_mangle)]
pub extern "C" fn odds_ratio_ci_lower(a: f64, b: f64, c: f64, d: f64, z: f64) -> f64 {
    odds_ratio_interval(a, b, c, d, z, false)
}

#[unsafe(no_mangle)]
pub extern "C" fn odds_ratio_ci_upper(a: f64, b: f64, c: f64, d: f64, z: f64) -> f64 {
    odds_ratio_interval(a, b, c, d, z, true)
}

fn risk_ratio_interval(a: f64, b: f64, c: f64, d: f64, z: f64, upper: bool) -> f64 {
    let exposed_total = a + b;
    let unexposed_total = c + d;
    let estimate = risk_ratio(a, b, c, d);
    if !valid_confidence_multiplier(z)
        || !estimate.is_finite()
        || a <= 0.0
        || c <= 0.0
        || exposed_total <= 0.0
        || unexposed_total <= 0.0
    {
        return f64::NAN;
    }
    let standard_error = libm::sqrt(b / (a * exposed_total) + d / (c * unexposed_total));
    let direction = if upper { 1.0 } else { -1.0 };
    libm::exp(libm::log(estimate) + direction * z * standard_error)
}

#[unsafe(no_mangle)]
pub extern "C" fn risk_ratio_ci_lower(a: f64, b: f64, c: f64, d: f64, z: f64) -> f64 {
    risk_ratio_interval(a, b, c, d, z, false)
}

#[unsafe(no_mangle)]
pub extern "C" fn risk_ratio_ci_upper(a: f64, b: f64, c: f64, d: f64, z: f64) -> f64 {
    risk_ratio_interval(a, b, c, d, z, true)
}

fn risk_difference_interval(a: f64, b: f64, c: f64, d: f64, z: f64, upper: bool) -> f64 {
    let exposed_total = a + b;
    let unexposed_total = c + d;
    let exposed = risk_exposed(a, b);
    let unexposed = risk_unexposed(c, d);
    let estimate = risk_difference(a, b, c, d);
    if !valid_confidence_multiplier(z)
        || !estimate.is_finite()
        || exposed_total <= 0.0
        || unexposed_total <= 0.0
    {
        return f64::NAN;
    }
    let variance =
        exposed * (1.0 - exposed) / exposed_total + unexposed * (1.0 - unexposed) / unexposed_total;
    let direction = if upper { 1.0 } else { -1.0 };
    estimate + direction * z * libm::sqrt(variance)
}

#[unsafe(no_mangle)]
pub extern "C" fn risk_difference_ci_lower(a: f64, b: f64, c: f64, d: f64, z: f64) -> f64 {
    risk_difference_interval(a, b, c, d, z, false)
}

#[unsafe(no_mangle)]
pub extern "C" fn risk_difference_ci_upper(a: f64, b: f64, c: f64, d: f64, z: f64) -> f64 {
    risk_difference_interval(a, b, c, d, z, true)
}

fn chi_square_denominator(a: f64, b: f64, c: f64, d: f64) -> f64 {
    (a + b) * (c + d) * (a + c) * (b + d)
}

#[unsafe(no_mangle)]
pub extern "C" fn pearson_chi_square(a: f64, b: f64, c: f64, d: f64) -> f64 {
    let total = a + b + c + d;
    let cross_product = a * d - b * c;
    ratio(
        total * cross_product * cross_product,
        chi_square_denominator(a, b, c, d),
    )
}

#[unsafe(no_mangle)]
pub extern "C" fn mantel_haenszel_chi_square(a: f64, b: f64, c: f64, d: f64) -> f64 {
    let total = a + b + c + d;
    let cross_product = a * d - b * c;
    ratio(
        (total - 1.0) * cross_product * cross_product,
        chi_square_denominator(a, b, c, d),
    )
}

#[unsafe(no_mangle)]
pub extern "C" fn yates_chi_square(a: f64, b: f64, c: f64, d: f64) -> f64 {
    let total = a + b + c + d;
    let adjusted = ((a * d - b * c).abs() - total / 2.0).max(0.0);
    ratio(
        total * adjusted * adjusted,
        chi_square_denominator(a, b, c, d),
    )
}

#[unsafe(no_mangle)]
pub extern "C" fn chi_square_p_value(value: f64) -> f64 {
    if !value.is_finite() || value < 0.0 {
        f64::NAN
    } else {
        libm::erfc(libm::sqrt(value / 2.0))
    }
}

fn regularized_gamma_q(shape: f64, value: f64) -> f64 {
    if !shape.is_finite() || shape <= 0.0 || !value.is_finite() || value < 0.0 {
        return f64::NAN;
    }
    if value == 0.0 {
        return 1.0;
    }
    let log_scale = -value + shape * libm::log(value) - libm::lgamma(shape);
    if value < shape + 1.0 {
        let mut term = 1.0 / shape;
        let mut sum = term;
        let mut denominator = shape;
        for _ in 0..256 {
            denominator += 1.0;
            term *= value / denominator;
            sum += term;
            if term.abs() <= sum.abs() * 1.0e-14 {
                break;
            }
        }
        (1.0 - sum * libm::exp(log_scale)).clamp(0.0, 1.0)
    } else {
        let tiny = 1.0e-300;
        let mut b = value + 1.0 - shape;
        let mut c = 1.0 / tiny;
        let mut d = 1.0 / b.max(tiny);
        let mut fraction = d;
        for iteration in 1..=256 {
            let i = iteration as f64;
            let coefficient = -i * (i - shape);
            b += 2.0;
            d = coefficient * d + b;
            if d.abs() < tiny {
                d = tiny;
            }
            c = b + coefficient / c;
            if c.abs() < tiny {
                c = tiny;
            }
            d = 1.0 / d;
            let delta = d * c;
            fraction *= delta;
            if (delta - 1.0).abs() <= 1.0e-14 {
                break;
            }
        }
        (fraction * libm::exp(log_scale)).clamp(0.0, 1.0)
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn chi_square_p_value_df(value: f64, degrees_of_freedom: f64) -> f64 {
    if !value.is_finite()
        || value < 0.0
        || !degrees_of_freedom.is_finite()
        || degrees_of_freedom <= 0.0
    {
        f64::NAN
    } else {
        regularized_gamma_q(0.5 * degrees_of_freedom, 0.5 * value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const TOLERANCE: f64 = 1.0e-12;

    fn assert_near(actual: f64, expected: f64) {
        assert!(
            (actual - expected).abs() <= TOLERANCE,
            "expected {expected}, received {actual}"
        );
    }

    #[test]
    fn outbreak_table_primitives_match_baseline() {
        let (a, b, c, d) = (40.0, 60.0, 10.0, 90.0);
        assert_near(risk_exposed(a, b), 0.4);
        assert_near(risk_unexposed(c, d), 0.1);
        assert_near(risk_ratio(a, b, c, d), 4.0);
        assert_near(odds_ratio(a, b, c, d), 6.0);
        assert_near(risk_difference(a, b, c, d), 0.3);
        assert_near(pearson_chi_square(a, b, c, d), 24.0);
        assert_near(mantel_haenszel_chi_square(a, b, c, d), 23.88);
        assert_near(yates_chi_square(a, b, c, d), 22.426_666_666_666_666);
        assert_near(
            odds_ratio_ci_lower(a, b, c, d, 1.959_963_984_540_054),
            2.788_969_870_879_16,
        );
        assert_near(
            odds_ratio_ci_upper(a, b, c, d, 1.959_963_984_540_054),
            12.907_991_719_771_363,
        );
        assert_near(
            risk_ratio_ci_lower(a, b, c, d, 1.959_963_984_540_054),
            2.119_528_043_731_343_3,
        );
        assert_near(
            risk_ratio_ci_upper(a, b, c, d, 1.959_963_984_540_054),
            7.548_850_343_037_993,
        );
        assert_near(
            risk_difference_ci_lower(a, b, c, d, 1.959_963_984_540_054),
            0.187_408_641_058_513_71,
        );
        assert_near(
            risk_difference_ci_upper(a, b, c, d, 1.959_963_984_540_054),
            0.412_591_358_941_486_35,
        );
        assert_near(chi_square_p_value(24.0), 0.000_000_963_357_008_643_096);
    }

    #[test]
    fn foodborne_potato_salad_candidate_fixture_matches() {
        let (a, b, c, d) = (36.0, 12.0, 8.0, 40.0);
        let z = 1.959_963_984_540_054;
        assert_near(risk_exposed(a, b), 0.75);
        assert_near(risk_unexposed(c, d), 1.0 / 6.0);
        assert_near(risk_ratio(a, b, c, d), 4.5);
        assert_near(risk_ratio_ci_lower(a, b, c, d, z), 2.341_416_454_323_163_7);
        assert_near(risk_ratio_ci_upper(a, b, c, d, z), 8.648_610_956_248_572);
        assert_near(odds_ratio(a, b, c, d), 15.0);
        assert_near(odds_ratio_ci_lower(a, b, c, d, z), 5.509_795_839_883_87);
        assert_near(odds_ratio_ci_upper(a, b, c, d, z), 40.836_358_830_446_66);
        assert_near(risk_difference(a, b, c, d), 7.0 / 12.0);
        let pearson = pearson_chi_square(a, b, c, d);
        assert_near(pearson, 32.895_104_895_104_89);
        assert_near(chi_square_p_value(pearson), 9.726_787_942_247_329e-9);
        assert_near(fisher_exact_left(a, b, c, d), 0.999_999_999_622_307_1);
        assert_near(fisher_exact_right(a, b, c, d), 6.061_730_729_553_414e-9);
        assert_near(
            fisher_exact_one_tailed(a, b, c, d),
            6.061_730_729_553_414e-9,
        );
        assert_near(
            fisher_exact_two_tailed(a, b, c, d),
            1.212_346_145_910_682_6e-8,
        );
        assert_near(mid_p_exact_left(a, b, c, d), 0.999_999_996_780_288_2);
        assert_near(mid_p_exact_right(a, b, c, d), 3.219_711_807_337_423_3e-9);
        assert_near(
            mid_p_exact_one_tailed(a, b, c, d),
            3.219_711_807_337_423_3e-9,
        );
        assert_near(conditional_odds_ratio(a, b, c, d), 14.451_968_824_923_464);
        assert_near(
            conditional_odds_ratio_fisher_lower(a, b, c, d, 0.95),
            5.013_623_166_423_638,
        );
        assert_near(
            conditional_odds_ratio_fisher_upper(a, b, c, d, 0.95),
            46.681_208_656_344_566,
        );
        assert_near(
            conditional_odds_ratio_mid_p_lower(a, b, c, d, 0.95),
            5.456_250_069_639_179,
        );
        assert_near(
            conditional_odds_ratio_mid_p_upper(a, b, c, d, 0.95),
            41.656_465_722_795_23,
        );
    }

    #[test]
    fn undefined_denominators_return_nan() {
        assert!(risk_exposed(0.0, 0.0).is_nan());
        assert!(risk_ratio(1.0, 1.0, 0.0, 0.0).is_nan());
        assert!(odds_ratio(1.0, 0.0, 1.0, 0.0).is_nan());
        assert!(odds_ratio_ci_lower(1.0, 0.0, 1.0, 1.0, 1.96).is_nan());
        assert!(risk_ratio_ci_upper(0.0, 1.0, 1.0, 1.0, 1.96).is_nan());
        assert!(chi_square_p_value(-1.0).is_nan());
        assert!(fisher_exact_left(-1.0, 1.0, 1.0, 1.0).is_nan());
        assert!(fisher_exact_left(0.5, 1.0, 1.0, 1.0).is_nan());
        assert!(fisher_exact_left(0.0, 0.0, 0.0, 0.0).is_nan());
        assert!(fisher_exact_left(100_001.0, 100_001.0, 100_001.0, 100_001.0).is_nan());
        assert!(conditional_odds_ratio(-1.0, 1.0, 1.0, 1.0).is_nan());
        assert!(conditional_odds_ratio(1.0, 0.0, 0.0, 0.0).is_nan());
        assert!(conditional_odds_ratio_fisher_lower(1.0, 1.0, 1.0, 1.0, 1.0).is_nan());
    }

    #[test]
    fn confidence_intervals_are_ordered_and_contain_estimates() {
        for &(a, b, c, d) in &[
            (1.0, 9.0, 5.0, 5.0),
            (20.0, 30.0, 15.0, 35.0),
            (500.0, 100.0, 250.0, 350.0),
        ] {
            let z = 1.959_963_984_540_054;
            let or = odds_ratio(a, b, c, d);
            assert!(
                odds_ratio_ci_lower(a, b, c, d, z) <= or
                    && or <= odds_ratio_ci_upper(a, b, c, d, z)
            );
            let rr = risk_ratio(a, b, c, d);
            assert!(
                risk_ratio_ci_lower(a, b, c, d, z) <= rr
                    && rr <= risk_ratio_ci_upper(a, b, c, d, z)
            );
            let rd = risk_difference(a, b, c, d);
            assert!(
                risk_difference_ci_lower(a, b, c, d, z) <= rd
                    && rd <= risk_difference_ci_upper(a, b, c, d, z)
            );
        }
    }

    #[test]
    fn chi_square_survival_probability_stays_in_range_and_decreases() {
        let values = [0.0, 0.5, 1.0, 3.841_458_820_694_124, 24.0, 100.0];
        let mut previous = 1.0;
        for value in values {
            let probability = chi_square_p_value(value);
            assert!((0.0..=1.0).contains(&probability));
            assert!(probability <= previous);
            previous = probability;
        }
        assert_near(chi_square_p_value(0.0), 1.0);
    }

    #[test]
    fn exact_tails_preserve_legacy_epi_info_invariants() {
        for &(a, b, c, d) in &[
            (21.0, 27.0, 27.0, 25.0),
            (29.0, 17.0, 28.0, 26.0),
            (1.0, 9.0, 5.0, 5.0),
            (0.0, 10.0, 2.0, 8.0),
        ] {
            let tails = exact_tails(a, b, c, d);
            assert!((0.0..=1.0).contains(&tails.left));
            assert!((0.0..=1.0).contains(&tails.right));
            assert!((0.0..=1.0).contains(&tails.two_tailed));
            assert_near(tails.one_tailed, tails.left.min(tails.right));
            assert_near(
                tails.mid_p_one_tailed,
                tails.mid_p_left.min(tails.mid_p_right),
            );
            assert_near(tails.mid_p_left + tails.mid_p_right, 1.0);
        }
        assert_near(
            fisher_exact_one_tailed(21.0, 27.0, 27.0, 25.0),
            0.268_763_215_305_748_8,
        );
        assert_near(
            fisher_exact_two_tailed(21.0, 27.0, 27.0, 25.0),
            0.430_953_259_839_725_04,
        );
    }

    #[test]
    fn conditional_odds_ratio_preserves_boundaries_and_reciprocity() {
        assert_near(conditional_odds_ratio(0.0, 10.0, 2.0, 8.0), 0.0);
        assert_near(
            conditional_odds_ratio_fisher_lower(0.0, 10.0, 2.0, 8.0, 0.95),
            0.0,
        );
        assert!(conditional_odds_ratio(10.0, 0.0, 8.0, 2.0).is_infinite());
        assert!(conditional_odds_ratio_fisher_upper(10.0, 0.0, 8.0, 2.0, 0.95).is_infinite());

        let estimate = conditional_odds_ratio(21.0, 27.0, 27.0, 25.0);
        let reversed = conditional_odds_ratio(27.0, 25.0, 21.0, 27.0);
        assert_near(estimate * reversed, 1.0);
        let lower = conditional_odds_ratio_fisher_lower(21.0, 27.0, 27.0, 25.0, 0.95);
        let upper = conditional_odds_ratio_fisher_upper(21.0, 27.0, 27.0, 25.0, 0.95);
        let reversed_lower = conditional_odds_ratio_fisher_lower(27.0, 25.0, 21.0, 27.0, 0.95);
        let reversed_upper = conditional_odds_ratio_fisher_upper(27.0, 25.0, 21.0, 27.0, 0.95);
        assert_near(lower * reversed_upper, 1.0);
        assert_near(upper * reversed_lower, 1.0);
    }

    #[test]
    fn stratified_mantel_haenszel_matches_legacy_formulas() {
        let _guard = STRATIFIED_TEST_LOCK.lock().unwrap();
        assert_eq!(stratified_set_table(0, 18.0, 6.0, 4.0, 20.0), 1);
        assert_eq!(stratified_set_table(1, 18.0, 6.0, 4.0, 20.0), 1);
        let z = 1.959_963_984_540_054;
        assert_near(stratified_mh_odds_ratio(2), 15.0);
        assert_near(stratified_mh_risk_ratio(2), 4.5);
        assert_near(
            stratified_mh_chi_square_uncorrected(2),
            32.209_790_209_790_214,
        );
        assert_near(
            stratified_mh_chi_square_corrected(2),
            29.950_174_825_174_827,
        );
        assert_near(
            stratified_mh_odds_ratio_ci_lower(2, z),
            5.509_795_839_883_87,
        );
        assert_near(
            stratified_mh_odds_ratio_ci_upper(2, z),
            40.836_358_830_446_66,
        );
        assert_near(
            stratified_mh_risk_ratio_ci_lower(2, z),
            2.341_416_454_323_164,
        );
        assert_near(
            stratified_mh_risk_ratio_ci_upper(2, z),
            8.648_610_956_248_572,
        );
        assert_near(stratified_breslow_day_odds_ratio(2), 0.0);
        assert_near(stratified_breslow_day_tarone_odds_ratio(2), 0.0);
        assert_near(stratified_legacy_woolf_odds_ratio(2), 0.0);
        assert_near(stratified_legacy_woolf_risk_ratio(2), 0.0);
        assert_near(stratified_conditional_odds_ratio(2), 13.924_175_864_733_59);
        assert_near(
            stratified_conditional_odds_ratio_fisher_lower(2, 0.95),
            4.885_405_167_537_105,
        );
        assert_near(
            stratified_conditional_odds_ratio_fisher_upper(2, 0.95),
            44.315_018_064_102_45,
        );
    }

    #[test]
    fn odds_ratio_homogeneity_detects_heterogeneous_strata() {
        let _guard = STRATIFIED_TEST_LOCK.lock().unwrap();
        assert_eq!(stratified_set_table(0, 10.0, 20.0, 15.0, 25.0), 1);
        assert_eq!(stratified_set_table(1, 30.0, 10.0, 10.0, 30.0), 1);
        assert_eq!(stratified_set_table(2, 8.0, 12.0, 14.0, 16.0), 1);
        assert_near(stratified_breslow_day_odds_ratio(3), 14.711_928_390_493_496);
        assert_near(
            stratified_breslow_day_tarone_odds_ratio(3),
            14.685_939_377_019_253,
        );
        assert_near(
            stratified_legacy_woolf_odds_ratio(3),
            14.157_859_408_564_644,
        );
        assert_near(
            stratified_legacy_woolf_risk_ratio(3),
            10.990_876_497_300_171,
        );
        assert_near(
            chi_square_p_value_df(14.711_928_390_493_496, 2.0),
            0.000_638_771_220_393_733_5,
        );
        assert_near(chi_square_p_value_df(0.0, 2.0), 1.0);
        assert_near(
            chi_square_p_value_df(10.990_876_497_300_171, 2.0),
            0.004_105_456_860_311_477,
        );
        assert_near(
            stratified_conditional_odds_ratio(3),
            2.026_006_280_850_072_7,
        );
        assert_near(
            stratified_conditional_odds_ratio_fisher_lower(3, 0.95),
            1.103_918_474_649_541,
        );
        assert_near(
            stratified_conditional_odds_ratio_fisher_upper(3, 0.95),
            3.748_470_311_826_656_2,
        );
    }

    #[test]
    fn stratified_exact_conditional_boundaries_are_explicit() {
        let _guard = STRATIFIED_TEST_LOCK.lock().unwrap();
        assert_eq!(stratified_set_table(0, 0.0, 10.0, 5.0, 5.0), 1);
        assert_eq!(stratified_set_table(1, 0.0, 8.0, 4.0, 6.0), 1);
        assert_eq!(stratified_conditional_odds_ratio(2), 0.0);
        assert_eq!(stratified_conditional_odds_ratio_fisher_lower(2, 0.95), 0.0);
        assert!(stratified_conditional_odds_ratio_fisher_upper(2, 0.95).is_finite());

        assert_eq!(stratified_set_table(0, 5.0, 5.0, 0.0, 10.0), 1);
        assert_eq!(stratified_set_table(1, 4.0, 6.0, 0.0, 8.0), 1);
        assert!(stratified_conditional_odds_ratio(2).is_infinite());
        assert!(stratified_conditional_odds_ratio_fisher_lower(2, 0.95).is_finite());
        assert!(stratified_conditional_odds_ratio_fisher_upper(2, 0.95).is_infinite());
    }

    #[test]
    fn stratified_exact_operational_limits_fail_closed() {
        let _guard = STRATIFIED_TEST_LOCK.lock().unwrap();
        assert_eq!(
            stratified_set_table(0, 4_097.0, 4_097.0, 4_097.0, 4_097.0),
            1
        );
        assert!(stratified_conditional_odds_ratio(1).is_nan());
        assert!(stratified_conditional_odds_ratio_fisher_lower(1, 0.95).is_nan());
        assert!(stratified_conditional_odds_ratio_fisher_upper(1, 0.95).is_nan());

        for index in 0..MAX_STRATA {
            assert_eq!(stratified_set_table(index as u32, 1.0, 1.0, 1.0, 1.0), 1);
        }
        assert_near(stratified_mh_odds_ratio(MAX_STRATA as u32), 1.0);
        assert_near(stratified_mh_risk_ratio(MAX_STRATA as u32), 1.0);
        assert!(stratified_conditional_odds_ratio(MAX_STRATA as u32).is_nan());
    }
}
