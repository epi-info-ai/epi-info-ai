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

/// Calculates the legacy dashboard rate: numerator / denominator * multiplier.
#[unsafe(no_mangle)]
pub extern "C" fn rate_calculate(numerator: f64, denominator: f64, multiplier: f64) -> f64 {
    if numerator.is_finite()
        && denominator.is_finite()
        && multiplier.is_finite()
        && numerator >= 0.0
        && denominator > 0.0
        && numerator <= denominator
        && multiplier > 0.0
    {
        (numerator / denominator) * multiplier
    } else {
        f64::NAN
    }
}

fn population_survey_norm_tail(z: f64) -> f64 {
    let z = libm::sqrt(z * z);
    let mut p = 1.0
        + z * (0.049_867_35
            + z * (0.021_141_01
                + z * (0.003_277_63
                    + z * (0.000_038_003_6 + z * (0.000_048_890_6 + z * 0.000_005_383)))));
    p *= p;
    p *= p;
    p *= p;
    1.0 / (p * p)
}

fn population_survey_anorm(probability: f64) -> f64 {
    let mut value = 0.5;
    let mut delta = 0.5;
    let mut z = 0.0;
    while delta > 0.000_001 {
        z = 1.0 / value - 1.0;
        delta /= 2.0;
        if population_survey_norm_tail(z) > probability {
            value -= delta;
        } else {
            value += delta;
        }
    }
    z
}

fn round_to_even_nonnegative(value: f64) -> f64 {
    let lower = libm::floor(value);
    let fraction = value - lower;
    if fraction < 0.5 {
        lower
    } else if fraction > 0.5 {
        lower + 1.0
    } else if lower % 2.0 == 0.0 {
        lower
    } else {
        lower + 1.0
    }
}

/// Reproduces the audited Epi Info Population Survey cluster-size sequence.
#[unsafe(no_mangle)]
pub extern "C" fn population_survey_cluster_size(
    population: f64,
    expected_frequency: f64,
    margin_of_error: f64,
    design_effect: f64,
    clusters: f64,
    confidence_level: f64,
) -> f64 {
    if !population.is_finite()
        || !expected_frequency.is_finite()
        || !margin_of_error.is_finite()
        || !design_effect.is_finite()
        || !clusters.is_finite()
        || !confidence_level.is_finite()
        || population <= 0.0
        || population != libm::floor(population)
        || expected_frequency <= 0.0
        || expected_frequency >= 100.0
        || margin_of_error <= 0.0
        || design_effect <= 0.0
        || clusters < 1.0
        || clusters != libm::floor(clusters)
        || confidence_level <= 0.0
        || confidence_level >= 1.0
    {
        return f64::NAN;
    }
    let factor =
        expected_frequency * (100.0 - expected_frequency) / (margin_of_error * margin_of_error);
    let z = population_survey_anorm(1.0 - confidence_level);
    let uncorrected = z * z * factor;
    let corrected = uncorrected / (1.0 + uncorrected / population);
    let rounded = round_to_even_nonnegative(corrected);
    libm::ceil(design_effect * rounded / clusters)
}

fn cohort_exposed_outcome_value(unexposed_outcome: f64, odds_ratio: f64) -> f64 {
    unexposed_outcome * odds_ratio / (1.0 + unexposed_outcome * (odds_ratio - 1.0))
}

/// Converts an odds ratio and unexposed outcome proportion to the exposed outcome proportion.
#[unsafe(no_mangle)]
pub extern "C" fn cohort_exposed_outcome(unexposed_outcome: f64, odds_ratio: f64) -> f64 {
    if !unexposed_outcome.is_finite()
        || !odds_ratio.is_finite()
        || unexposed_outcome <= 0.0
        || unexposed_outcome >= 1.0
        || odds_ratio <= 0.0
    {
        return f64::NAN;
    }
    cohort_exposed_outcome_value(unexposed_outcome, odds_ratio)
}

/// Converts a risk ratio and unexposed outcome proportion to an odds ratio.
#[unsafe(no_mangle)]
pub extern "C" fn cohort_odds_from_risk(unexposed_outcome: f64, risk_ratio: f64) -> f64 {
    let exposed_outcome = unexposed_outcome * risk_ratio;
    if !unexposed_outcome.is_finite()
        || !risk_ratio.is_finite()
        || unexposed_outcome <= 0.0
        || unexposed_outcome >= 1.0
        || risk_ratio <= 0.0
        || exposed_outcome >= 1.0
    {
        return f64::NAN;
    }
    exposed_outcome * (1.0 - unexposed_outcome)
        / (unexposed_outcome * (1.0 - exposed_outcome))
}

/// Converts exposed and unexposed outcome proportions to an odds ratio.
#[unsafe(no_mangle)]
pub extern "C" fn cohort_odds_from_outcomes(
    unexposed_outcome: f64,
    exposed_outcome: f64,
) -> f64 {
    if !unexposed_outcome.is_finite()
        || !exposed_outcome.is_finite()
        || unexposed_outcome <= 0.0
        || unexposed_outcome >= 1.0
        || exposed_outcome <= 0.0
        || exposed_outcome >= 1.0
    {
        return f64::NAN;
    }
    exposed_outcome * (1.0 - unexposed_outcome)
        / (unexposed_outcome * (1.0 - exposed_outcome))
}

/// Reproduces the legacy Kelsey/Fleiss cohort and cross-sectional sample sizes.
#[unsafe(no_mangle)]
pub extern "C" fn cohort_sample_size(
    method: f64,
    group: f64,
    confidence_level: f64,
    power_percent: f64,
    unexposed_to_exposed_ratio: f64,
    unexposed_outcome: f64,
    odds_ratio: f64,
) -> f64 {
    if !method.is_finite()
        || !group.is_finite()
        || !confidence_level.is_finite()
        || !power_percent.is_finite()
        || !unexposed_to_exposed_ratio.is_finite()
        || !unexposed_outcome.is_finite()
        || !odds_ratio.is_finite()
        || method < 0.0
        || method > 2.0
        || method != libm::floor(method)
        || group < 0.0
        || group > 1.0
        || group != libm::floor(group)
        || confidence_level <= 0.0
        || confidence_level >= 1.0
        || power_percent <= 0.0
        || power_percent >= 100.0
        || unexposed_to_exposed_ratio <= 0.0
        || unexposed_outcome <= 0.0
        || unexposed_outcome >= 1.0
        || odds_ratio <= 0.0
        || odds_ratio == 1.0
    {
        return f64::NAN;
    }
    let exposed_outcome = cohort_exposed_outcome_value(unexposed_outcome, odds_ratio);
    let power = power_percent / 100.0;
    let za = population_survey_anorm(1.0 - confidence_level);
    let zb = if power < 0.5 {
        -population_survey_anorm(2.0 * power)
    } else {
        population_survey_anorm(2.0 - 2.0 * power)
    };
    let ratio = unexposed_to_exposed_ratio;
    let pbar = (exposed_outcome + ratio * unexposed_outcome) / (1.0 + ratio);
    let qbar = 1.0 - pbar;
    let difference = exposed_outcome - unexposed_outcome;
    let kelsey = (za + zb) * (za + zb) * pbar * qbar * (ratio + 1.0)
        / (difference * difference * ratio);
    let fleiss_numerator = za * libm::sqrt((ratio + 1.0) * pbar * qbar)
        + zb
            * libm::sqrt(
                ratio * exposed_outcome * (1.0 - exposed_outcome)
                    + unexposed_outcome * (1.0 - unexposed_outcome),
            );
    let fleiss = fleiss_numerator * fleiss_numerator / (ratio * difference * difference);
    let correction = 1.0
        + libm::sqrt(
            1.0 + 2.0 * (ratio + 1.0) / (fleiss * ratio * libm::fabs(difference)),
        );
    let corrected = fleiss * correction * correction / 4.0;
    let raw = if method == 0.0 {
        kelsey
    } else if method == 1.0 {
        fleiss
    } else {
        corrected
    };
    libm::ceil(raw * if group == 0.0 { 1.0 } else { ratio })
}

const MAX_MEANS_VALUES: usize = 65_536;
static mut MEANS_VALUES: [f64; MAX_MEANS_VALUES] = [0.0; MAX_MEANS_VALUES];
static mut MEANS_LENGTH: usize = 0;
#[cfg(test)]
static MEANS_TEST_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

#[unsafe(no_mangle)]
pub extern "C" fn means_reset() {
    unsafe { MEANS_LENGTH = 0 };
}

#[unsafe(no_mangle)]
pub extern "C" fn means_set_value(index: u32, value: f64) -> u32 {
    let index = index as usize;
    let length = unsafe { MEANS_LENGTH };
    if !value.is_finite() || index != length || index >= MAX_MEANS_VALUES {
        return 0;
    }
    let values = core::ptr::addr_of_mut!(MEANS_VALUES) as *mut f64;
    unsafe {
        *values.add(index) = value;
        MEANS_LENGTH = length + 1;
    }
    1
}

fn means_sift_down(values: *mut f64, mut root: usize, end: usize) {
    loop {
        let child = root * 2 + 1;
        if child >= end {
            break;
        }
        let right = child + 1;
        let largest = if right < end && unsafe { *values.add(right) > *values.add(child) } {
            right
        } else {
            child
        };
        if unsafe { *values.add(root) >= *values.add(largest) } {
            break;
        }
        unsafe { core::ptr::swap(values.add(root), values.add(largest)) };
        root = largest;
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn means_prepare(count: u32) -> u32 {
    let count = count as usize;
    if count == 0 || count != unsafe { MEANS_LENGTH } {
        return 0;
    }
    let values = core::ptr::addr_of_mut!(MEANS_VALUES) as *mut f64;
    let mut start = count / 2;
    while start > 0 {
        start -= 1;
        means_sift_down(values, start, count);
    }
    let mut end = count;
    while end > 1 {
        unsafe { core::ptr::swap(values, values.add(end - 1)) };
        end -= 1;
        means_sift_down(values, 0, end);
    }
    1
}

fn valid_means_count(count: u32) -> Option<usize> {
    let count = count as usize;
    if count > 0 && count == unsafe { MEANS_LENGTH } {
        Some(count)
    } else {
        None
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn means_sum(count: u32) -> f64 {
    let Some(count) = valid_means_count(count) else {
        return f64::NAN;
    };
    let values = core::ptr::addr_of!(MEANS_VALUES) as *const f64;
    let mut sum = 0.0;
    for index in 0..count {
        sum += unsafe { *values.add(index) };
    }
    sum
}

#[unsafe(no_mangle)]
pub extern "C" fn means_mean(count: u32) -> f64 {
    means_sum(count) / count as f64
}

#[unsafe(no_mangle)]
pub extern "C" fn means_sample_variance(count: u32) -> f64 {
    let Some(count) = valid_means_count(count) else {
        return f64::NAN;
    };
    if count < 2 {
        return f64::NAN;
    }
    let mean = means_mean(count as u32);
    let values = core::ptr::addr_of!(MEANS_VALUES) as *const f64;
    let mut squared_deviations = 0.0;
    for index in 0..count {
        let difference = unsafe { *values.add(index) } - mean;
        squared_deviations += difference * difference;
    }
    squared_deviations / (count - 1) as f64
}

#[unsafe(no_mangle)]
pub extern "C" fn means_sample_std_dev(count: u32) -> f64 {
    libm::sqrt(means_sample_variance(count))
}

fn means_order_statistic(count: u32, fraction: f64) -> f64 {
    let Some(count) = valid_means_count(count) else {
        return f64::NAN;
    };
    let position = count as f64 * fraction;
    let values = core::ptr::addr_of!(MEANS_VALUES) as *const f64;
    if position == libm::floor(position) {
        let upper = position as usize;
        0.5 * unsafe { *values.add(upper - 1) + *values.add(upper) }
    } else {
        unsafe { *values.add(libm::ceil(position) as usize - 1) }
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn means_minimum(count: u32) -> f64 {
    if valid_means_count(count).is_some() {
        unsafe { *(core::ptr::addr_of!(MEANS_VALUES) as *const f64) }
    } else {
        f64::NAN
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn means_quartile_25(count: u32) -> f64 {
    means_order_statistic(count, 0.25)
}

#[unsafe(no_mangle)]
pub extern "C" fn means_median(count: u32) -> f64 {
    means_order_statistic(count, 0.5)
}

#[unsafe(no_mangle)]
pub extern "C" fn means_quartile_75(count: u32) -> f64 {
    means_order_statistic(count, 0.75)
}

#[unsafe(no_mangle)]
pub extern "C" fn means_maximum(count: u32) -> f64 {
    let Some(count) = valid_means_count(count) else {
        return f64::NAN;
    };
    let values = core::ptr::addr_of!(MEANS_VALUES) as *const f64;
    unsafe { *values.add(count - 1) }
}

#[unsafe(no_mangle)]
pub extern "C" fn means_mode(count: u32) -> f64 {
    let Some(count) = valid_means_count(count) else {
        return f64::NAN;
    };
    let values = core::ptr::addr_of!(MEANS_VALUES) as *const f64;
    let mut mode = unsafe { *values };
    let mut mode_count = 1;
    let mut current_count = 1;
    for index in 1..count {
        let value = unsafe { *values.add(index) };
        let previous = unsafe { *values.add(index - 1) };
        if value == previous {
            current_count += 1;
        } else {
            current_count = 1;
        }
        if current_count > mode_count {
            mode = value;
            mode_count = current_count;
        }
    }
    mode
}

fn valid_frequency_counts(frequency: f64, total: f64) -> bool {
    frequency.is_finite()
        && total.is_finite()
        && frequency >= 0.0
        && total > 0.0
        && frequency <= total
        && frequency == libm::floor(frequency)
        && total == libm::floor(total)
}

#[unsafe(no_mangle)]
pub extern "C" fn frequency_proportion(frequency: f64, total: f64) -> f64 {
    if valid_frequency_counts(frequency, total) {
        frequency / total
    } else {
        f64::NAN
    }
}

fn binomial_cdf(k: u32, n: u32, probability: f64) -> f64 {
    if k >= n || probability <= 0.0 {
        return 1.0;
    }
    if probability >= 1.0 {
        return 0.0;
    }
    let log_p = libm::log(probability);
    let log_q = libm::log(1.0 - probability);
    let mut log_choose = 0.0;
    let mut maximum = f64::NEG_INFINITY;
    for value in 0..=k {
        if value > 0 {
            log_choose += libm::log((n - value + 1) as f64) - libm::log(value as f64);
        }
        let term = log_choose + value as f64 * log_p + (n - value) as f64 * log_q;
        if term > maximum {
            maximum = term;
        }
    }
    log_choose = 0.0;
    let mut scaled_sum = 0.0;
    for value in 0..=k {
        if value > 0 {
            log_choose += libm::log((n - value + 1) as f64) - libm::log(value as f64);
        }
        let term = log_choose + value as f64 * log_p + (n - value) as f64 * log_q;
        scaled_sum += libm::exp(term - maximum);
    }
    let result = libm::exp(maximum) * scaled_sum;
    if result > 1.0 { 1.0 } else { result }
}

fn frequency_exact_limit(frequency: u32, total: u32, upper: bool) -> f64 {
    const TAIL: f64 = 0.025;
    if !upper && frequency == 0 {
        return 0.0;
    }
    if upper && frequency == total {
        return 1.0;
    }
    let estimate = frequency as f64 / total as f64;
    let (mut low, mut high) = if upper {
        (estimate, 1.0)
    } else {
        (0.0, estimate)
    };
    for _ in 0..100 {
        let midpoint = 0.5 * (low + high);
        if upper {
            let probability = binomial_cdf(frequency, total, midpoint);
            if probability > TAIL {
                low = midpoint;
            } else {
                high = midpoint;
            }
        } else {
            let probability = binomial_cdf(total - frequency, total, 1.0 - midpoint);
            if probability > TAIL {
                high = midpoint;
            } else {
                low = midpoint;
            }
        }
    }
    0.5 * (low + high)
}

fn frequency_confidence_limit(frequency: f64, total: f64, upper: bool) -> f64 {
    if !valid_frequency_counts(frequency, total) {
        return f64::NAN;
    }
    if total < 300.0 {
        return frequency_exact_limit(frequency as u32, total as u32, upper);
    }
    // Preserve the Classic Analysis special case: an all-observation category
    // reports 100% to 100% once the Wilson branch is selected.
    if frequency == total {
        return 1.0;
    }
    let proportion = frequency / total;
    let z = 1.96;
    let z_squared = z * z;
    let denominator = 1.0 + z_squared / total;
    let center = proportion + z_squared / (2.0 * total);
    let radius =
        z * libm::sqrt(proportion * (1.0 - proportion) / total + z_squared / (4.0 * total * total));
    let result = if upper {
        (center + radius) / denominator
    } else {
        (center - radius) / denominator
    };
    if result < 0.0 {
        0.0
    } else if result > 1.0 {
        1.0
    } else {
        result
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn frequency_ci_lower(frequency: f64, total: f64) -> f64 {
    frequency_confidence_limit(frequency, total, false)
}

#[unsafe(no_mangle)]
pub extern "C" fn frequency_ci_upper(frequency: f64, total: f64) -> f64 {
    frequency_confidence_limit(frequency, total, true)
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
    fn foodborne_frequency_matches_classic_exact_limits() {
        for &(frequency, proportion, lower, upper) in &[
            (
                22.0,
                22.0 / 96.0,
                0.149_533_972_475_310_25,
                0.326_149_383_771_466_74,
            ),
            (
                52.0,
                52.0 / 96.0,
                0.436_863_394_077_502_74,
                0.643_829_657_203_814_2,
            ),
            (
                16.0,
                16.0 / 96.0,
                0.098_372_774_577_247_41,
                0.256_499_967_520_848_47,
            ),
            (
                6.0,
                6.0 / 96.0,
                0.023_279_587_730_772_49,
                0.131_085_035_801_940_8,
            ),
        ] {
            assert_near(frequency_proportion(frequency, 96.0), proportion);
            assert_near(frequency_ci_lower(frequency, 96.0), lower);
            assert_near(frequency_ci_upper(frequency, 96.0), upper);
        }
    }

    #[test]
    fn foodborne_age_means_matches_legacy_descriptive_contract() {
        let _guard = MEANS_TEST_LOCK.lock().expect("means test lock");
        let ages = [
            5.0, 7.0, 8.0, 11.0, 12.0, 14.0, 15.0, 16.0, 16.0, 17.0, 18.0, 19.0, 19.0, 20.0, 21.0,
            22.0, 23.0, 23.0, 24.0, 25.0, 26.0, 26.0, 27.0, 27.0, 28.0, 28.0, 29.0, 29.0, 30.0,
            31.0, 31.0, 31.0, 32.0, 33.0, 33.0, 34.0, 34.0, 35.0, 35.0, 36.0, 37.0, 37.0, 38.0,
            38.0, 38.0, 39.0, 39.0, 40.0, 41.0, 41.0, 42.0, 42.0, 42.0, 43.0, 44.0, 44.0, 45.0,
            45.0, 46.0, 46.0, 47.0, 47.0, 48.0, 48.0, 49.0, 49.0, 50.0, 51.0, 52.0, 52.0, 53.0,
            54.0, 55.0, 55.0, 56.0, 57.0, 58.0, 58.0, 59.0, 59.0, 61.0, 62.0, 63.0, 63.0, 64.0,
            65.0, 66.0, 67.0, 68.0, 69.0, 70.0, 71.0, 72.0, 73.0, 74.0, 75.0,
        ];
        means_reset();
        for (index, value) in ages.iter().enumerate() {
            assert_eq!(means_set_value(index as u32, *value), 1);
        }
        assert_eq!(means_prepare(ages.len() as u32), 1);
        assert_near(means_sum(96), 3917.0);
        assert_near(means_mean(96), 40.802_083_333_333_336);
        assert_near(means_sample_variance(96), 312.644_627_192_982_57);
        assert_near(means_sample_std_dev(96), 17.681_759_731_231_01);
        assert_eq!(means_minimum(96), 5.0);
        assert_eq!(means_quartile_25(96), 27.5);
        assert_eq!(means_median(96), 40.5);
        assert_eq!(means_quartile_75(96), 54.5);
        assert_eq!(means_maximum(96), 75.0);
        assert_eq!(means_mode(96), 31.0);
    }

    #[test]
    fn foodborne_confirmed_case_rate_matches_dashboard_contract() {
        assert_near(rate_calculate(22.0, 96.0, 100.0), 22.916_666_666_666_668);
        assert_near(rate_calculate(22.0, 96.0, 1_000.0), 229.166_666_666_666_66);
    }

    #[test]
    fn rate_rejects_invalid_counts_and_multiplier() {
        assert!(rate_calculate(1.0, 0.0, 100.0).is_nan());
        assert!(rate_calculate(11.0, 10.0, 100.0).is_nan());
        assert!(rate_calculate(-1.0, 10.0, 100.0).is_nan());
        assert!(rate_calculate(1.0, 10.0, 0.0).is_nan());
    }

    #[test]
    fn population_survey_defaults_match_the_legacy_table() {
        let levels = [0.80, 0.90, 0.95, 0.97, 0.99, 0.999, 0.9999];
        let expected = [164.0, 270.0, 384.0, 471.0, 663.0, 1082.0, 1512.0];
        for (level, sample) in levels.iter().zip(expected) {
            assert_eq!(
                population_survey_cluster_size(999_999.0, 50.0, 5.0, 1.0, 1.0, *level),
                sample
            );
        }
    }

    #[test]
    fn population_survey_applies_design_and_cluster_sequence() {
        assert_eq!(
            population_survey_cluster_size(10_000.0, 50.0, 5.0, 2.0, 10.0, 0.95),
            74.0
        );
        assert!(population_survey_cluster_size(0.0, 50.0, 5.0, 1.0, 1.0, 0.95).is_nan());
        assert!(population_survey_cluster_size(1000.0, 50.0, 0.0, 1.0, 1.0, 0.95).is_nan());
        assert!(population_survey_cluster_size(1000.0, 100.0, 5.0, 1.0, 1.0, 0.95).is_nan());
    }

    #[test]
    fn cohort_sample_sizes_match_the_legacy_source_example() {
        let expected = [(13.0, 13.0), (12.0, 12.0), (16.0, 16.0)];
        for (method, (exposed, unexposed)) in expected.iter().enumerate() {
            assert_eq!(
                cohort_sample_size(method as f64, 0.0, 0.95, 80.0, 1.0, 0.05, 24.0),
                *exposed
            );
            assert_eq!(
                cohort_sample_size(method as f64, 1.0, 0.95, 80.0, 1.0, 0.05, 24.0),
                *unexposed
            );
        }
    }

    #[test]
    fn cohort_sample_sizes_support_unequal_groups_and_reject_no_effect() {
        let expected = [(196.0, 391.0), (205.0, 410.0), (223.0, 446.0)];
        for (method, (exposed, unexposed)) in expected.iter().enumerate() {
            assert_eq!(
                cohort_sample_size(method as f64, 0.0, 0.95, 80.0, 2.0, 0.10, 2.0),
                *exposed
            );
            assert_eq!(
                cohort_sample_size(method as f64, 1.0, 0.95, 80.0, 2.0, 0.10, 2.0),
                *unexposed
            );
        }
        assert!(cohort_sample_size(0.0, 0.0, 0.95, 80.0, 1.0, 0.05, 1.0).is_nan());
    }

    #[test]
    fn cohort_effect_measure_conversions_are_consistent() {
        let exposed = cohort_exposed_outcome(0.05, 24.0);
        assert_near(exposed, 0.558_139_534_883_721);
        assert_near(cohort_odds_from_outcomes(0.05, exposed), 24.0);
        assert_near(cohort_odds_from_risk(0.05, exposed / 0.05), 24.0);
    }

    #[test]
    fn means_rejects_invalid_buffers_and_marks_singleton_variance_unavailable() {
        let _guard = MEANS_TEST_LOCK.lock().expect("means test lock");
        means_reset();
        assert_eq!(means_set_value(1, 2.0), 0);
        assert_eq!(means_set_value(0, f64::NAN), 0);
        assert_eq!(means_set_value(0, 2.0), 1);
        assert_eq!(means_prepare(2), 0);
        assert_eq!(means_prepare(1), 1);
        assert!(means_sample_variance(1).is_nan());
        assert_eq!(means_median(1), 2.0);
    }

    #[test]
    fn frequency_limits_preserve_boundaries_and_wilson_switch() {
        assert_eq!(frequency_ci_lower(0.0, 10.0), 0.0);
        assert_near(frequency_ci_upper(0.0, 10.0), 0.308_497_107_818_760_8);
        assert_near(frequency_ci_lower(10.0, 10.0), 0.691_502_892_181_239_2);
        assert_eq!(frequency_ci_upper(10.0, 10.0), 1.0);
        assert_eq!(frequency_ci_lower(300.0, 300.0), 1.0);
        assert_eq!(frequency_ci_upper(300.0, 300.0), 1.0);
        assert!(frequency_proportion(-1.0, 10.0).is_nan());
        assert!(frequency_ci_lower(11.0, 10.0).is_nan());
        assert!(frequency_ci_upper(0.0, 0.0).is_nan());
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
